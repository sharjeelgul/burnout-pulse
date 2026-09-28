/* =====================================================================
   BURNOUT PULSE v13: application logic
   ---------------------------------------------------------------------
   Local-first. Every account's data is encrypted at rest in this
   browser with AES-256-GCM under a key derived from the passphrase
   (PBKDF2-SHA-256, 600,000 iterations). The key lives in memory only
   while unlocked. Nothing is stored in plaintext except a salted hash
   used to find the account record.

   Network: the only request this page ever makes is to the same-origin
   coach endpoint, and only after the user opts in to the live coach.
   Messages classified as crisis are never sent.
   ===================================================================== */
(function () {
  "use strict";

  var APP_VERSION = "13.0.0";
  var CFG = window.BP_CONFIG || {};
  var S = window.BPSafety;
  var C = window.BPCore;
  var $ = function (id) { return document.getElementById(id); };

  /* ------------------------------------------------------------------
     DOM helpers (no inline styles, no untrusted innerHTML: CSP-safe)
     ------------------------------------------------------------------ */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "cls") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function svgIcon(inner, cls) {
    // inner comes only from constants in core.js, never from user input.
    var wrap = document.createElement("span");
    wrap.innerHTML = '<svg class="' + (cls || "icon") + '" viewBox="0 0 24 24" aria-hidden="true">' + inner + "</svg>";
    return wrap.firstChild;
  }
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  /* ------------------------------------------------------------------
     Crypto vault
     ------------------------------------------------------------------ */
  var LS = null;
  try { LS = window.localStorage; LS.setItem("bp2.probe", "1"); LS.removeItem("bp2.probe"); } catch (e) { LS = null; }
  var subtle = window.crypto && window.crypto.subtle;
  var ITER = 600000;
  var PREFIX = "bp2.acct.";
  var enc = new TextEncoder(), dec = new TextDecoder();

  function b64(buf) {
    var bytes = new Uint8Array(buf), s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function normEmail(e) { return String(e || "").trim().toLowerCase(); }
  function acctId(email) {
    return subtle.digest("SHA-256", enc.encode("burnout-pulse:v2:" + normEmail(email)))
      .then(function (h) { return PREFIX + Array.from(new Uint8Array(h)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join(""); });
  }
  function deriveKey(pass, salt, iter) {
    return subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: iter },
        base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }
  function seal(key, salt, iter, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(JSON.stringify(obj))).then(function (ct) {
      return { v: 2, kdf: "PBKDF2-SHA256", iter: iter, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
    });
  }
  function unseal(key, rec) {
    return subtle.decrypt({ name: "AES-GCM", iv: unb64(rec.iv) }, key, unb64(rec.ct))
      .then(function (pt) { return JSON.parse(dec.decode(pt)); });
  }
  function readRec(id) { try { return JSON.parse(LS.getItem(id) || "null"); } catch (e) { return null; } }

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  var session = null; // { id, key, salt, iter }
  var state = null;   // decrypted payload
  var answers = {};

  function blankState(email, name) {
    return { v: 2, email: normEmail(email), name: name, created: new Date().toISOString(),
      history: [], coachLog: [], prefs: { liveCoach: null } };
  }

  var writeChain = Promise.resolve();
  function persist() {
    if (!session || !state) return writeChain;
    var snap = JSON.parse(JSON.stringify(state)), s = session;
    writeChain = writeChain.then(function () {
      return seal(s.key, s.salt, s.iter, snap).then(function (rec) {
        LS.setItem(s.id, JSON.stringify(rec));
      });
    }).catch(function (err) {
      var full = err && (err.name === "QuotaExceededError" || err.code === 22);
      toast(full ? "Storage is full. Download your data, then clear coach history in Settings."
                 : "Couldn't save. Your last change may not be stored.");
    });
    return writeChain;
  }

  /* ------------------------------------------------------------------
     Sign-in / create / lock
     ------------------------------------------------------------------ */
  var COMMON = ["password", "passphrase", "123456", "qwerty", "letmein", "iloveyou", "welcome", "hospital", "surgery", "doctor", "burnout"];
  var mode = "signin";

  function setMode(m) {
    mode = m;
    var up = m === "signup";
    $("nameField").hidden = !up;
    $("authBtn").textContent = up ? "Create account" : "Sign in";
    $("switchPrompt").textContent = up ? "Already have an account on this device?" : "New here?";
    $("switchBtn").textContent = up ? "Sign in" : "Create an account";
    $("passInput").setAttribute("autocomplete", up ? "new-password" : "current-password");
    $("passHint").textContent = up
      ? "Use 15 or more characters; four unrelated words works well. It encrypts your data on this device and can't be recovered. Forget it and your history is gone."
      : "Your passphrase decrypts your data on this device.";
    $("formError").hidden = true;
  }
  function formError(msg, focusId) {
    var e = $("formError"); e.textContent = msg; e.hidden = false;
    if (focusId) $(focusId).focus();
    busy(false);
  }
  function busy(on) {
    var b = $("authBtn");
    b.disabled = on;
    b.textContent = on ? "Working…" : (mode === "signup" ? "Create account" : "Sign in");
  }
  function validPassphrase(pass, email) {
    if (pass.length < 15) return "Use at least 15 characters. A few unrelated words is easiest to remember.";
    var low = pass.toLowerCase(), local = normEmail(email).split("@")[0];
    if (/^(.)\1+$/.test(pass)) return "That passphrase is too easy to guess.";
    if (COMMON.some(function (w) { return low === w || low.replace(/[^a-z]/g, "") === w; })) return "That passphrase is too common.";
    if (local.length >= 4 && low.indexOf(local) !== -1) return "Don't include your email address in your passphrase.";
    return null;
  }

  function handleAuth(ev) {
    ev.preventDefault();
    if (!subtle || !LS) return;
    var email = normEmail($("emailInput").value);
    var pass = $("passInput").value;
    var name = $("nameInput").value.trim().slice(0, 40);
    $("formError").hidden = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return formError("Enter a valid email address.", "emailInput");
    busy(true);
    acctId(email).then(function (id) {
      var rec = readRec(id);
      if (mode === "signup") {
        if (!name) return formError("Add a first name so the app can greet you.", "nameInput");
        var bad = validPassphrase(pass, email);
        if (bad) return formError(bad, "passInput");
        if (rec || legacyAccount(email)) return formError("An account for that email already exists on this device. Sign in instead.", "emailInput");
        var salt = crypto.getRandomValues(new Uint8Array(16));
        return deriveKey(pass, salt, ITER).then(function (key) {
          session = { id: id, key: key, salt: salt, iter: ITER };
          state = blankState(email, name);
          return persist().then(enterApp);
        });
      }
      if (!rec) {
        if (legacyAccount(email)) return migrateLegacy(email, pass, id);
        return formError("That email and passphrase don't match an account on this device.", "passInput");
      }
      var salt2 = unb64(rec.salt);
      return deriveKey(pass, salt2, rec.iter).then(function (key) {
        return unseal(key, rec).then(function (data) {
          session = { id: id, key: key, salt: salt2, iter: rec.iter };
          state = data;
          enterApp();
        }, function () {
          // Same message for unknown email and wrong passphrase.
          formError("That email and passphrase don't match an account on this device.", "passInput");
        });
      });
    }).catch(function () { formError("Something went wrong. Try again."); });
  }

  /* v12 stored a Base64 passphrase and plaintext data. Migrate once,
     then delete every legacy key so nothing readable remains. */
  function legacyAccount(email) {
    try { return (JSON.parse(LS.getItem("bp.accounts") || "{}"))[normEmail(email)] || null; } catch (e) { return null; }
  }
  function legacyDataKey(email) {
    try { return "bp.data." + btoa(normEmail(email)); } catch (e) { return null; }
  }
  function migrateLegacy(email, pass, id) {
    var u = legacyAccount(email), ok = false;
    try { ok = btoa(pass) === u.pass; } catch (e) { ok = false; }
    if (!ok) return formError("That email and passphrase don't match an account on this device.", "passInput");
    var old = null, dk = legacyDataKey(email);
    try { old = JSON.parse(LS.getItem(dk) || "null"); } catch (e) { old = null; }
    var st = blankState(email, u.name);
    if (old) {
      st.history = (old.history || []).filter(function (h) { return h && C.isValidAnswers(h.answers); }).map(function (h) {
        return { date: h.date, score: C.computeScore(h.answers), answers: h.answers, context: null };
      });
      st.coachLog = (old.coachLog || []).filter(function (m) { return m && typeof m.text === "string"; }).map(function (m) {
        var role = m.role === "user" ? "user" : m.role === "care" ? "care" : "coach";
        return { role: role, text: m.text, at: m.at || Date.now(), tier: role === "user" ? S.classify(m.text) : undefined, source: "offline" };
      });
    }
    var salt = crypto.getRandomValues(new Uint8Array(16));
    return deriveKey(pass, salt, ITER).then(function (key) {
      session = { id: id, key: key, salt: salt, iter: ITER };
      state = st;
      if (pass.length < 15) state.prefs.suggestNewPass = true;
      return persist().then(function () {
        var users = {};
        try { users = JSON.parse(LS.getItem("bp.accounts") || "{}"); } catch (e) {}
        delete users[normEmail(email)];
        if (Object.keys(users).length) LS.setItem("bp.accounts", JSON.stringify(users)); else LS.removeItem("bp.accounts");
        if (dk) LS.removeItem(dk);
        LS.removeItem("bp.active");
        LS.removeItem("bp.board"); // v12 leaderboard is retired
        enterApp();
        toast("Your data moved to encrypted storage. The old copy was deleted.");
      });
    });
  }

  function lock(msg) {
    session = null; state = null; answers = {};
    clearTimeout(idleTimer);
    $("passInput").value = "";
    $("coachThread").textContent = "";
    $("main").hidden = true; $("topbar").hidden = true; $("footer").hidden = true;
    $("gate").hidden = false;
    setMode("signin");
    busy(false);
    if (msg) { var e = $("formError"); e.textContent = msg; e.hidden = false; }
    $("passInput").focus();
  }

  var idleTimer = null;
  function bumpIdle() {
    if (!session) return;
    clearTimeout(idleTimer);
    var mins = Math.max(1, CFG.idleLockMinutes || 15);
    idleTimer = setTimeout(function () { lock("Locked after " + mins + " minutes of inactivity. Sign in to continue."); }, mins * 60000);
  }
  ["pointerdown", "keydown", "scroll", "touchstart"].forEach(function (ev) {
    document.addEventListener(ev, bumpIdle, { passive: true });
  });

  /* ------------------------------------------------------------------
     Enter app
     ------------------------------------------------------------------ */
  function enterApp() {
    // Ask the browser not to evict this site's storage. Safari can delete
    // script-writable storage after 7 days without a visit; Home Screen
    // web apps are exempt, which Settings explains.
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    $("gate").hidden = true;
    $("topbar").hidden = false; $("main").hidden = false; $("footer").hidden = false;
    $("passInput").value = "";
    busy(false);
    var g = $("greetLine");
    g.textContent = "";
    g.appendChild(document.createTextNode("How are you, "));
    g.appendChild(el("em", { text: "really" }));
    g.appendChild(document.createTextNode(", " + state.name + "?"));
    $("weekTag").textContent = "Week of " + shortDate(new Date());
    answers = {};
    buildDimensions();
    renderScore();
    renderTrend();
    renderSettings();
    coachSessionStart = 0;
    renderCoach();
    switchTab("checkin", false);
    bumpIdle();
    $("greetLine").focus();
  }

  /* ------------------------------------------------------------------
     Check-in
     ------------------------------------------------------------------ */
  function buildDimensions() {
    var wrap = $("dims");
    wrap.textContent = "";
    C.DIMENSIONS.forEach(function (d) {
      var fs = el("fieldset", { cls: "dim", id: "dim-" + d.id });
      var leg = el("legend", null, [
        el("span", { cls: "dim-icon", "aria-hidden": "true" }, [svgIcon(d.icon)]),
        el("span", null, [el("span", { cls: "dim-name", text: d.name }), el("span", { cls: "dim-q", text: d.q })])
      ]);
      fs.appendChild(leg);
      var scale = el("div", { cls: "scale" });
      d.anchors.forEach(function (a, i) {
        var input = el("input", { type: "radio", name: "dim-" + d.id, value: String(i), id: "r-" + d.id + "-" + i });
        input.addEventListener("change", function () {
          answers[d.id] = i;
          fs.classList.add("answered");
          renderScore();
        });
        scale.appendChild(el("label", { cls: "opt", "for": "r-" + d.id + "-" + i }, [input, el("span", { text: a })]));
      });
      fs.appendChild(scale);
      wrap.appendChild(fs);
    });
    $("ctxHours").value = ""; $("ctxCall").value = ""; $("ctxAdverse").checked = false;
    $("contextBox").open = false;
  }

  function renderScore() {
    var n = Object.keys(answers).length, total = C.DIM_IDS.length;
    $("dimCount").textContent = n + " of " + total + " answered";
    var score = C.computeScore(answers);
    var band = C.bandFor(score);
    var ring = $("ringFill");
    var pct = score !== null ? score / 100 : n / total * 0.999;
    ring.style.strokeDashoffset = String(402 * (1 - pct));
    ring.setAttribute("data-band", band.key);
    $("ringScore").textContent = score !== null ? String(score) : n === 0 ? "—" : "…";
    var pb = $("pulseBand");
    pb.textContent = band.label; pb.setAttribute("data-band", band.key);
    if (score !== null) {
      $("pulseTitle").textContent = band.title;
      $("pulseDesc").textContent = "Score " + score + " of 100. " + band.desc;
    } else {
      $("pulseTitle").textContent = "Your score, once you finish";
      $("pulseDesc").textContent = n === 0 ? "Answer the six questions below. Higher scores mean more strain."
        : (total - n) + " to go.";
    }
    var ready = score !== null;
    $("saveBtn").setAttribute("aria-disabled", ready ? "false" : "true");
    $("saveTitle").textContent = ready ? "Ready when you are" : "Answer all six to save";
    $("saveSub").textContent = ready ? "Saved encrypted on this device only." : (total - n) + " question" + (total - n === 1 ? "" : "s") + " left.";
  }

  function readContext() {
    var c = {};
    var h = $("ctxHours").value.trim();
    if (h !== "") { var hv = Math.round(Number(h)); if (isFinite(hv) && hv >= 0 && hv <= 168) c.hours = hv; }
    var cn = $("ctxCall").value;
    if (cn !== "") c.callNights = parseInt(cn, 10);
    if ($("ctxAdverse").checked) c.adverseEvent = true;
    return Object.keys(c).length ? c : null;
  }

  $("checkinForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var score = C.computeScore(answers);
    if (score === null) {
      var first = C.DIM_IDS.filter(function (k) { return answers[k] === undefined; })[0];
      toast("Answer all six questions to save.");
      var r = document.querySelector('input[name="dim-' + first + '"]');
      if (r) r.focus();
      return;
    }
    var entry = { date: new Date().toISOString(), score: score, answers: Object.assign({}, answers), context: readContext() };
    var replaced = false;
    if (state.history[0] && sameDay(state.history[0].date, entry.date)) { state.history[0] = entry; replaced = true; }
    else state.history.unshift(entry);
    state.history = state.history.slice(0, CFG.maxCheckins || 104);
    persist();
    toast(replaced ? "Updated today's check-in" : "Check-in saved");
    answers = {};
    buildDimensions();
    renderScore();
    renderTrend();
    switchTab("trend", true);
  });

  /* ------------------------------------------------------------------
     Trend
     ------------------------------------------------------------------ */
  function renderTrend() {
    var hist = state.history;
    var body = $("historyBody"), chart = $("chartBody");
    body.textContent = ""; chart.textContent = "";
    $("sustainedCard").hidden = !C.sustainedDepleted(hist);
    renderSupport();
    // When the latest score is in the depleted band, resources move to the
    // top of the page instead of waiting below the advice.
    var sup = $("supportCard"), view = $("view-trend");
    if (hist[0] && hist[0].score >= 75) view.insertBefore(sup, $("chartBody"));
    else view.appendChild(sup);
    if (!hist.length) {
      body.appendChild(el("div", { cls: "history-empty" }, [el("p", { text: "No check-ins yet. Save your first one and your trend and advice will show up here." })]));
      $("adviceBlock").hidden = true;
      return;
    }
    if (hist.length >= 2) chart.appendChild(buildChart(hist.slice(0, 12).reverse()));
    var list = el("ol", { cls: "history-list", "aria-label": "Recent check-ins, newest first" });
    hist.slice(0, 8).forEach(function (h, i) {
      var band = C.bandFor(h.score), prev = hist[i + 1], tr = "First check-in";
      if (prev) {
        var d = h.score - prev.score;
        tr = d > 2 ? "Up " + d : d < -2 ? "Down " + Math.abs(d) : "About the same";
      }
      list.appendChild(el("li", { cls: "card hrow", "data-band": band.key }, [
        el("span", { cls: "hrow-score" }, [el("span", { cls: "sr-only", text: "Score " }), String(h.score)]),
        el("span", { cls: "hrow-meta" }, [el("span", { cls: "hrow-date", text: longDate(h.date) }), el("br"), el("span", { cls: "hrow-band", text: band.label })]),
        el("span", { cls: "hrow-trend", text: tr })
      ]));
    });
    body.appendChild(list);
    renderAdvice(hist[0]);
  }

  function buildChart(pts) {
    var NS = "http://www.w3.org/2000/svg", W = 600, H = 120, pad = 18;
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    [0, 25, 50, 75, 100].forEach(function (v) {
      var y = H - pad - (v / 100) * (H - 2 * pad);
      var ln = document.createElementNS(NS, "line");
      ln.setAttribute("x1", "0"); ln.setAttribute("x2", String(W)); ln.setAttribute("y1", y); ln.setAttribute("y2", y);
      ln.setAttribute("class", "grid"); svg.appendChild(ln);
    });
    var step = pts.length > 1 ? (W - 2 * pad) / (pts.length - 1) : 0;
    var coords = pts.map(function (p, i) { return [pad + i * step, H - pad - (p.score / 100) * (H - 2 * pad)]; });
    var path = document.createElementNS(NS, "polyline");
    path.setAttribute("points", coords.map(function (c) { return c.join(","); }).join(" "));
    path.setAttribute("class", "line"); svg.appendChild(path);
    coords.forEach(function (c) {
      var dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", c[0]); dot.setAttribute("cy", c[1]); dot.setAttribute("r", "4"); dot.setAttribute("class", "pt");
      svg.appendChild(dot);
    });
    var first = pts[0], last = pts[pts.length - 1];
    var cap = "Last " + pts.length + " check-ins, oldest to newest: " + pts.map(function (p) { return p.score; }).join(", ") +
      ". From " + first.score + " on " + shortDate(new Date(first.date)) + " to " + last.score + " on " + shortDate(new Date(last.date)) + ". Higher means more strain.";
    return el("figure", { cls: "card chart" }, [svg, el("figcaption", { text: cap })]);
  }

  function renderAdvice(entry) {
    var wrap = $("adviceWrap");
    wrap.textContent = "";
    $("adviceBlock").hidden = false;
    C.contextAdvice(entry.context).forEach(function (a) {
      wrap.appendChild(el("div", { cls: "card advice-card" }, [
        el("div", { cls: "advice-head" }, [el("h4", { text: a.name }), el("span", { cls: "tag ctx", text: "This week" })]),
        el("p", { text: a.text })
      ]));
    });
    // Lead with the three most strained dimensions; fold the rest away so
    // the page gives a short, prioritised read rather than a wall of cards.
    var sorted = C.DIMENSIONS.slice().sort(function (a, b) { return entry.answers[b.id] - entry.answers[a.id]; });
    function card(d) {
      var v = entry.answers[d.id], lvl = C.levelFor(v);
      return el("div", { cls: "card advice-card" }, [
        el("div", { cls: "advice-head" }, [el("h4", { text: d.name }),
          el("span", { cls: "tag " + lvl, text: lvl === "ok" ? "Holding" : lvl === "watch" ? "Watch" : "Needs care" })]),
        el("p", { text: v >= 2 ? C.ADVICE[d.id].strained : C.ADVICE[d.id].ok })
      ]);
    }
    sorted.slice(0, 3).forEach(function (d) { wrap.appendChild(card(d)); });
    var more = el("details", { cls: "card howscore" }, [el("summary", { text: "The other three dimensions" })]);
    var inner = el("div", { cls: "advice-wrap more-wrap" });
    sorted.slice(3).forEach(function (d) { inner.appendChild(card(d)); });
    more.appendChild(inner);
    wrap.appendChild(more);
  }

  function resourceItems() {
    var items = S.institutionResources(CFG).map(function (r) {
      var link = r.phone ? el("a", { href: "tel:" + String(r.phone).replace(/[^0-9+]/g, ""), text: r.phone })
                         : el("a", { href: r.url, text: "Website", rel: "noopener noreferrer", target: "_blank" });
      return el("li", null, [el("strong", { text: r.label }), el("span", { text: (r.detail ? r.detail + " " : "") }), link]);
    });
    S.RESOURCES.forEach(function (r) {
      items.push(el("li", null, [el("strong", null, [r.label + ": ", el("a", { href: r.href, text: r.display })]), el("span", { text: r.detail })]));
    });
    return items;
  }
  function renderSupport() {
    var card = $("supportCard");
    card.textContent = "";
    card.appendChild(el("h3", { text: "If a week feels heavier than usual" }));
    card.appendChild(el("p", { cls: "muted", text: "A high score is a signal to talk to someone, not a verdict." }));
    card.appendChild(el("ul", { cls: "res-list" }, resourceItems()));
  }

  /* ------------------------------------------------------------------
     Coach
     ------------------------------------------------------------------ */
  var coachSessionStart = 0, coachBusy = false;
  var canLive = !!CFG.coachEndpoint && location.protocol !== "file:";
  function isLive() { return canLive && state && state.prefs.liveCoach === true; }

  function renderCoach() {
    var th = $("coachThread");
    th.textContent = "";
    $("aiName").textContent = CFG.aiProcessorName || "the AI provider";
    $("consentCard").hidden = !(canLive && state.prefs.liveCoach === null);
    updateCoachMode();
    disclose();
    state.coachLog.forEach(function (m) { drawMsg(m); });
  }
  function disclose() {
    var now = Date.now();
    if (coachSessionStart && now - coachSessionStart < 3 * 3600 * 1000) return;
    coachSessionStart = now;
    Array.prototype.forEach.call(document.querySelectorAll("#coachThread .bubble-system"), function (n) { n.remove(); });
    var txt = isLive()
      ? "You're talking with an AI, not a person. It can't diagnose or treat anything, and it can't contact anyone for you. If you're in danger, call or text 988."
      : "These are offline reflection prompts, not an AI and not a person. They can't diagnose, treat, or contact anyone. If you're in danger, call or text 988.";
    $("coachThread").appendChild(el("div", { cls: "bubble bubble-system", text: txt }));
  }
  function updateCoachMode() {
    var live = isLive();
    var badge = $("coachBadge");
    badge.textContent = live ? "AI · live" : "Offline prompts";
    badge.classList.toggle("live", live);
    $("coachNote").textContent = live
      ? "Live AI coach. Messages you send go to " + (CFG.aiProcessorName || "the AI provider") + " to generate a reply. Saved encrypted on this device."
      : "Offline prompts, not AI. Nothing leaves this device. Saved encrypted here.";
  }

  function careBlock() {
    var b = el("div", { cls: "bubble bubble-care", role: "alert" });
    S.CRISIS_INTRO.split("\n\n").forEach(function (p) { b.appendChild(el("p", { text: p })); });
    b.appendChild(el("ul", { cls: "res-list" }, resourceItems()));
    b.appendChild(el("p", { text: S.CRISIS_OUTRO }));
    return b;
  }
  function drawMsg(m) {
    var th = $("coachThread"), n;
    if (m.role === "care") n = careBlock();
    else if (m.role === "note") n = el("div", { cls: "bubble bubble-note", text: S.CONCERN_NOTE });
    else if (m.role === "user") n = el("div", { cls: "bubble bubble-user" }, [el("span", { cls: "who", text: "You" }), document.createTextNode(m.text)]);
    else n = el("div", { cls: "bubble bubble-coach" }, [el("span", { cls: "who", text: m.source === "ai" ? "Coach (AI)" : "Offline prompt" }), document.createTextNode(m.text)]);
    th.appendChild(n);
    return n;
  }
  function scrollEnd() { window.scrollTo({ top: document.body.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
  function push(m) {
    state.coachLog.push(m);
    var max = CFG.maxCoachMessages || 300;
    if (state.coachLog.length > max) state.coachLog = state.coachLog.slice(-max);
    drawMsg(m);
    scrollEnd();
  }

  var coachInput = $("coachInput");
  coachInput.addEventListener("input", function () {
    coachInput.style.height = "auto";
    coachInput.style.height = Math.min(coachInput.scrollHeight, 140) + "px";
    $("coachSend").disabled = coachInput.value.trim().length === 0 || coachBusy;
  });
  coachInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendToCoach(); }
  });
  $("coachForm").addEventListener("submit", function (e) { e.preventDefault(); sendToCoach(); });
  $("consentYes").addEventListener("click", function () { setLive(true); coachInput.focus(); });
  $("consentNo").addEventListener("click", function () { setLive(false); coachInput.focus(); });

  function setLive(on) {
    state.prefs.liveCoach = on;
    persist();
    $("consentCard").hidden = true;
    coachSessionStart = 0;
    updateCoachMode();
    disclose();
    renderSettings();
    toast(on ? "Live AI coach on" : "Live coach off. Offline prompts only.");
  }

  function sendToCoach() {
    var text = coachInput.value.trim().slice(0, 2000);
    if (!text || coachBusy) return;
    coachBusy = true;
    coachInput.value = ""; coachInput.style.height = "auto";
    $("coachSend").disabled = true;
    disclose();
    var tier = S.classify(text);
    var priorLog = state.coachLog.slice();
    push({ role: "user", text: text, at: Date.now(), tier: tier });

    if (tier === "crisis") {
      // Never sent anywhere. Never answered with a generated reply.
      push({ role: "care", at: Date.now() });
      persist();
      coachBusy = false;
      return;
    }
    persist();
    var typing = el("div", { cls: "bubble bubble-coach typing", "aria-label": "Coach is replying" }, [el("span"), el("span"), el("span")]);
    $("coachThread").appendChild(typing);
    scrollEnd();

    getReply(text, priorLog).then(function (r) {
      typing.remove();
      if (r.tier === "crisis") { push({ role: "care", at: Date.now() }); }
      else {
        push({ role: "coach", text: r.reply, at: Date.now(), source: r.source });
        if (tier === "concern" || r.tier === "concern") push({ role: "note", at: Date.now() });
      }
      if (r.notice) toast(r.notice);
    }).catch(function () {
      typing.remove();
      push({ role: "coach", text: offlineReply(text), at: Date.now(), source: "offline" });
    }).then(function () {
      persist();
      coachBusy = false;
      $("coachSend").disabled = coachInput.value.trim().length === 0;
    });
  }

  function coachContext() {
    var h = state.history[0];
    if (!h) return null;
    var c = { score: h.score, band: C.bandFor(h.score).key,
      strained: C.DIM_IDS.filter(function (k) { return h.answers[k] >= 3; }) };
    if (state.history[1]) c.direction = h.score - state.history[1].score;
    if (h.context) {
      if (h.context.adverseEvent) c.adverseEvent = true;
      if (typeof h.context.hours === "number") c.over80 = h.context.hours > 80;
    }
    return c;
  }

  function getReply(text, priorLog) {
    if (!isLive()) return new Promise(function (res) {
      setTimeout(function () { res({ reply: offlineReply(text), source: "offline" }); }, 500 + Math.random() * 500);
    });
    var history = priorLog.filter(function (m) {
      return (m.role === "user" && m.tier !== "crisis") || (m.role === "coach" && m.source === "ai");
    }).slice(-12).map(function (m) { return { role: m.role, text: String(m.text).slice(0, 2000) }; });
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 20000);
    return fetch(CFG.coachEndpoint, {
      method: "POST", credentials: "same-origin", signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text, history: history, context: coachContext() })
    }).then(function (r) {
      clearTimeout(timer);
      if (r.status === 429) return { reply: offlineReply(text), source: "offline", notice: "The live coach is busy. Showing an offline prompt." };
      if (!r.ok) return { reply: offlineReply(text), source: "offline", notice: "The live coach is unavailable. Showing an offline prompt." };
      return r.json().then(function (d) {
        if (d && d.tier === "crisis") return { tier: "crisis" };
        if (d && typeof d.reply === "string" && d.reply) return { reply: d.reply, source: "ai", tier: d.tier };
        return { reply: offlineReply(text), source: "offline" };
      });
    }, function () {
      clearTimeout(timer);
      return { reply: offlineReply(text), source: "offline", notice: "The live coach didn't respond. Showing an offline prompt." };
    });
  }

  /* Offline prompts. Not AI: simple, honest reflection prompts that use
     the latest check-in. They never repeat the previous line. */
  var lastPick = {};
  function pick(arr, slot) {
    var i; do { i = Math.floor(Math.random() * arr.length); } while (arr.length > 1 && i === lastPick[slot]);
    lastPick[slot] = i; return arr[i];
  }
  var LEADS = {
    heavy: ["That sounds genuinely depleting, and one conversation won't fix it.", "Carrying that much for that long wears anyone down.", "That's a heavy load to be holding."],
    sad: ["I'm sorry it's sitting this heavy right now.", "You don't have to talk yourself out of feeling it.", "It's okay that this is hard."],
    angry: ["That frustration makes sense. Anger in this work usually points at something real.", "You sound fed up, and from what you describe, fairly so."],
    anxious: ["Anticipating the next hard thing is its own kind of exhausting.", "That worry sounds tiring to carry around."],
    good: ["Good. The better stretches are worth noticing too.", "That's worth sitting with for a second."],
    neutral: ["Thanks for putting it into words.", "Okay. Take it at your pace."]
  };
  var CLOSERS = {
    hard: ["What would be the smallest real relief this week?", "If one piece of this got lighter, which would you pick?", "What part of this is heaviest right now?"],
    good: ["What made the difference? Naming it makes it easier to find again.", "What would it take to get more of that?"],
    asking: ["I don't have a reliable answer to that, and I won't make one up. What does your own gut say?", "What's making this one feel pressing right now?"],
    neutral: ["What's been sitting with you most?", "Where do you think this is coming from?"]
  };
  function offlineReply(text) {
    var t = text.toLowerCase(), h = state.history[0];
    var heavy = /tired|exhausted|drained|burn(t|ed) out|overwhelm|too much|nothing left|running on empty|post.?call|no sleep/.test(t);
    var sad = /\bsad\b|\blow\b|cry|lonely|numb/.test(t);
    var angry = /angry|furious|frustrat|unfair|fed up|sick of/.test(t);
    var anxious = /anxious|worried|scared|afraid|nervous|panic|dread/.test(t);
    var good = /good day|went well|felt great|proud|happy|grateful|better/.test(t);
    var asking = /\?\s*$/.test(text);
    var mood = heavy ? "heavy" : sad ? "sad" : angry ? "angry" : anxious ? "anxious" : good ? "good" : "neutral";
    var mid = "";
    if (h) {
      var strained = C.DIMENSIONS.filter(function (d) { return h.answers[d.id] >= 3; }).map(function (d) { return d.name.toLowerCase(); });
      if (strained.length && (heavy || sad || anxious)) mid = " Your last check-in flagged " + joinWords(strained) + ", so this fits what the scores showed.";
      else if (state.history[1] && h.score - state.history[1].score > 8) mid = " Your score went up since the check-in before, so this may have been building.";
    } else {
      mid = " Once you've done a check-in, I can ask about specifics.";
    }
    var close = pick(CLOSERS[asking ? "asking" : (heavy || sad || anxious) ? "hard" : good ? "good" : "neutral"], "c");
    return pick(LEADS[mood], "l") + mid + " " + close;
  }
  function joinWords(a) { return a.length < 3 ? a.join(" and ") : a.slice(0, -1).join(", ") + ", and " + a[a.length - 1]; }

  /* ------------------------------------------------------------------
     Settings
     ------------------------------------------------------------------ */
  function renderSettings() {
    $("acctLine").textContent = "Signed in as " + state.name + " (" + state.email + ") on this device.";
    var tg = $("liveToggle"), on = state.prefs.liveCoach === true;
    tg.setAttribute("aria-checked", on ? "true" : "false");
    tg.disabled = !canLive;
    $("liveDesc").textContent = !canLive
      ? "Not available in this deployment. Replies are offline prompts and nothing leaves this device."
      : on ? "On. Messages you send the coach go to " + (CFG.aiProcessorName || "the AI provider") + " to generate replies. Crisis messages never do."
           : "Off. Replies are offline prompts and nothing leaves this device.";
    $("versionLine").textContent = "Version " + APP_VERSION + " · safety rules " + S.version;
    $("instLine").textContent = CFG.institutionName ? "Provided for " + CFG.institutionName + "." : "";
    $("passAdvice").textContent = state.prefs.suggestNewPass
      ? "Your passphrase is shorter than 15 characters. It was carried over from the old version, and a longer one makes your encrypted data much harder to break."
      : "Your passphrase is the encryption key for this account. Changing it re-encrypts everything.";
  }
  $("liveToggle").addEventListener("click", function () { if (canLive) setLive(state.prefs.liveCoach !== true); });

  $("exportBtn").addEventListener("click", function () {
    var data = JSON.stringify({ exportedAt: new Date().toISOString(), app: "Burnout Pulse " + APP_VERSION,
      name: state.name, email: state.email, history: state.history, coachLog: state.coachLog }, null, 2);
    var url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    var a = el("a", { href: url, download: "burnout-pulse-export.json" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Downloaded. The file is not encrypted.");
  });
  $("clearCoachBtn").addEventListener("click", function () {
    state.coachLog = [];
    persist();
    coachSessionStart = 0;
    renderCoach();
    toast("Coach history cleared");
  });
  $("deleteBtn").addEventListener("click", function () {
    $("deleteStep1").hidden = true; $("deleteStep2").hidden = false; $("deleteConfirm").value = ""; $("deleteConfirm").focus();
  });
  $("deleteCancelBtn").addEventListener("click", function () {
    $("deleteStep2").hidden = true; $("deleteStep1").hidden = false; $("deleteBtn").focus();
  });
  $("deleteConfirmBtn").addEventListener("click", function () {
    if ($("deleteConfirm").value.trim() !== "DELETE") { toast("Type DELETE to confirm."); $("deleteConfirm").focus(); return; }
    var id = session.id;
    writeChain.then(function () {
      LS.removeItem(id);
      $("deleteStep2").hidden = true; $("deleteStep1").hidden = false;
      lock("Your account and all its data were erased from this browser.");
    });
  });
  $("lockBtn").addEventListener("click", function () { lock(); });

  $("passForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var cur = $("curPass").value, nw = $("newPass").value, err = $("passError");
    err.hidden = true;
    function fail(m, f) { err.textContent = m; err.hidden = false; $(f).focus(); }
    var bad = validPassphrase(nw, state.email);
    if (bad) return fail(bad, "newPass");
    var rec = readRec(session.id);
    deriveKey(cur, unb64(rec.salt), rec.iter).then(function (k) { return unseal(k, rec); }).then(function () {
      var salt = crypto.getRandomValues(new Uint8Array(16));
      return deriveKey(nw, salt, ITER).then(function (key) {
        session = { id: session.id, key: key, salt: salt, iter: ITER };
        delete state.prefs.suggestNewPass;
        return persist();
      }).then(function () {
        $("curPass").value = ""; $("newPass").value = "";
        renderSettings();
        toast("Passphrase changed. Your data was re-encrypted.");
      });
    }, function () { fail("Current passphrase is incorrect.", "curPass"); });
  });

  /* ------------------------------------------------------------------
     Tabs (WAI-ARIA tabs pattern, manual activation)
     ------------------------------------------------------------------ */
  var TABS = ["checkin", "trend", "coach", "settings"];
  function switchTab(which, moveFocus) {
    TABS.forEach(function (k) {
      var on = k === which, tab = $("tab-" + k);
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      $("view-" + k).hidden = !on;
    });
    if (which === "coach") {
      if (state && canLive && state.prefs.liveCoach === null) $("consentCard").hidden = false;
      setTimeout(scrollEnd, 60);
    } else window.scrollTo(0, 0);
    if (moveFocus) { var h = $("view-" + which).querySelector("h2"); if (h) h.focus(); }
  }
  TABS.forEach(function (k, i) {
    var tab = $("tab-" + k);
    tab.addEventListener("click", function () { switchTab(k, false); });
    tab.addEventListener("keydown", function (e) {
      var j = null;
      if (e.key === "ArrowRight") j = (i + 1) % TABS.length;
      else if (e.key === "ArrowLeft") j = (i - 1 + TABS.length) % TABS.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = TABS.length - 1;
      if (j !== null) { e.preventDefault(); switchTab(TABS[j], false); $("tab-" + TABS[j]).focus(); }
    });
  });

  /* ------------------------------------------------------------------
     Dates
     ------------------------------------------------------------------ */
  function sameDay(a, b) { var x = new Date(a), y = new Date(b); return x.toDateString() === y.toDateString(); }
  function shortDate(d) { return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  function longDate(iso) { return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  $("switchBtn").addEventListener("click", function () { setMode(mode === "signin" ? "signup" : "signin"); $("emailInput").focus(); });
  $("authForm").addEventListener("submit", handleAuth);
  setMode("signin");
  if (!subtle || !LS || !window.TextEncoder) {
    $("cryptoMissing").hidden = false;
    $("authBtn").disabled = true;
  }
})();
