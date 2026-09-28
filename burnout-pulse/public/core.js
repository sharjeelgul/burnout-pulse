/* =====================================================================
   Burnout Pulse: core (instrument, scoring, advice)
   ---------------------------------------------------------------------
   Pure functions and data, no DOM. Loaded by the browser as a classic
   script and by the server and tests as a side-effect import. Exposes
   globalThis.BPCore.

   The instrument is a SELF-REFLECTION measure. It is NOT the Maslach
   Burnout Inventory, not validated, and its band cut-points are not
   clinical thresholds. Every item is worded so that a higher answer
   means more strain, and every item has its own response anchors.
   ===================================================================== */
(function (root) {
  "use strict";

  var FREQ = ["Never", "Rarely", "Sometimes", "Often", "Almost always"];
  var AMOUNT = ["Not at all", "A little", "Moderately", "Very", "Completely"];

  var DIMENSIONS = [
    { id: "energy", name: "Energy left over",
      q: "By the end of a workday this past week, how depleted did you feel?",
      anchors: AMOUNT,
      icon: '<path d="M13 2 3 14h7v8l10-12h-7V2z"/>' },
    { id: "detach", name: "Connection to patients",
      q: "How often did you feel detached or cynical toward the people you cared for?",
      anchors: FREQ,
      icon: '<path d="M19 14c1.5-1.5 3-3.3 3-5.5A4.5 4.5 0 0 0 12 6 4.5 4.5 0 0 0 2 8.5C2 13 12 21 12 21s4-3.1 7-7z"/>' },
    { id: "efficacy", name: "Sense of doing good work",
      q: "How often did you doubt that your work was making a difference?",
      anchors: FREQ,
      icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>' },
    { id: "control", name: "Control over your day",
      q: "How often did your schedule or workload feel outside your control?",
      anchors: FREQ,
      icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
    { id: "rest", name: "Recovery off the clock",
      q: "How often did you come back from time off still feeling unrested?",
      anchors: FREQ,
      icon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>' },
    { id: "dread", name: "How the next shift feels",
      q: "How much dread did you feel about your next shift, case, or call?",
      anchors: ["None", "A little", "Some", "A lot", "Overwhelming"],
      icon: '<circle cx="12" cy="12" r="10"/><path d="M8 15s1.5-2 4-2 4 2 4 2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>' }
  ];
  var DIM_IDS = DIMENSIONS.map(function (d) { return d.id; });

  function isValidAnswers(a) {
    if (!a || typeof a !== "object") return false;
    var keys = Object.keys(a);
    if (keys.length !== DIM_IDS.length) return false;
    return DIM_IDS.every(function (k) {
      var v = a[k];
      return typeof v === "number" && v % 1 === 0 && v >= 0 && v <= 4;
    });
  }

  // 0-100, higher = more strain. Returns null until all six are answered.
  // Only known dimension ids count, so stray keys cannot move the score.
  function computeScore(a) {
    if (!isValidAnswers(a)) return null;
    var raw = 0;
    DIM_IDS.forEach(function (k) { raw += a[k]; });
    return Math.round((raw / (DIM_IDS.length * 4)) * 100);
  }

  var BANDS = [
    { key: "steady", max: 24, label: "Steady", title: "You're holding steady",
      desc: "Most dimensions look healthy this week. Notice what's working so you can protect it." },
    { key: "strained", max: 49, label: "Some strain", title: "A few things are pulling on you",
      desc: "A couple of dimensions are stretched. A small change now is easier than a big one later." },
    { key: "heavy", max: 74, label: "Running heavy", title: "This is a heavy stretch",
      desc: "Several dimensions are strained at once. This is a good week to say it out loud to someone you trust." },
    { key: "depleted", max: 100, label: "Depleted", title: "You're close to empty",
      desc: "Most dimensions are deep in the red. Please treat this as a reason to reach out to a person, not a number to sit with alone." }
  ];
  var BAND_KEYS = BANDS.map(function (b) { return b.key; });

  function bandFor(score) {
    if (score === null || score === undefined) return { key: "none", label: "Not scored yet", title: "", desc: "" };
    for (var i = 0; i < BANDS.length; i++) if (score <= BANDS[i].max) return BANDS[i];
    return BANDS[BANDS.length - 1];
  }

  // Answer 0-1 = holding, 2 = watch, 3-4 = needs care.
  function levelFor(v) { return v <= 1 ? "ok" : v === 2 ? "watch" : "care"; }

  var ADVICE = {
    energy: {
      ok: "Energy is holding. Notice what protected it this week so you can repeat it.",
      strained: "End-of-day depletion is one of the earliest signs of burnout. Pick one recovery anchor and defend it: a real meal away from a screen, or a hard stop on one task you keep carrying home. One, not five."
    },
    detach: {
      ok: "You still feel connected to the people you treat. That connection is part of what makes the work bearable.",
      strained: "Feeling less for patients is not a character flaw. It is what exhaustion does to empathy. Treat it as a fuel gauge, not a verdict. It tends to recover when the other dimensions do."
    },
    efficacy: {
      ok: "You can still see that your work matters. Hold on to specific moments, not just the general sense.",
      strained: "When the sense of doing good work fades, write down one concrete thing that went right this week, however small. Burnout erases those first."
    },
    control: {
      ok: "You had a reasonable say over your time. Control is one of the strongest buffers against burnout.",
      strained: "Low control is one of the biggest drivers of burnout and the hardest to fix alone. Name one specific process that wasted your time this week, and raise that one thing with someone who can change it."
    },
    rest: {
      ok: "Your time off is doing its job. That is not a given in this work.",
      strained: "If time off is not restoring you, the problem is usually quality, not quantity. Protect one stretch that is genuinely yours: no charts, no inbox, no clinical reading."
    },
    dread: {
      ok: "You are not dreading what's next. That is worth noticing.",
      strained: "Dread before a shift or case is worth taking seriously, especially if it is becoming the norm. If it stays high for more than a couple of weeks, that is a clear reason to talk to someone: a colleague you trust, your chief, or your wellbeing office."
    }
  };

  /* Optional surgical context. Recorded with the check-in, never scored.
     Hours and call nights are self-reported and not a duty-hour log. */
  function isValidContext(c) {
    if (c == null) return true;
    if (typeof c !== "object") return false;
    if (c.hours != null && !(typeof c.hours === "number" && c.hours % 1 === 0 && c.hours >= 0 && c.hours <= 168)) return false;
    if (c.callNights != null && !(typeof c.callNights === "number" && c.callNights % 1 === 0 && c.callNights >= 0 && c.callNights <= 7)) return false;
    if (c.adverseEvent != null && typeof c.adverseEvent !== "boolean") return false;
    return true;
  }

  function contextAdvice(c) {
    var out = [];
    if (!c) return out;
    if (typeof c.hours === "number" && c.hours > 80) {
      out.push({ id: "hours", name: "Hours this week",
        text: "You logged more than 80 hours. For residents and fellows, the ACGME limit is 80 hours a week averaged over four weeks. Record your hours accurately in your program's system. If this week is typical rather than an exception, raise it with your program director or chief. Accurate logs are how programs find out that schedules need to change." });
    }
    if (typeof c.callNights === "number" && c.callNights >= 3) {
      out.push({ id: "call", name: "Nights on call",
        text: "Three or more call nights in a week leaves a sleep debt that one day off does not repay. If you can, protect the first post-call sleep before errands, email, or reading, and avoid driving drowsy after a call night." });
    }
    if (c.adverseEvent === true) {
      out.push({ id: "adverse", name: "A patient outcome is weighing on you",
        text: "A complication or a bad outcome can hit hard even when the care was sound. Clinicians often call this the “second victim” experience, and it is common among surgeons. Talking it through with a peer soon helps more than waiting for M&M. If your institution has a peer support program for adverse events, this is exactly what it is for." });
    }
    return out;
  }

  /* Pattern checks used by the UI. history is newest-first. */
  function sustainedDepleted(history) {
    if (!history || history.length < 3) return false;
    return history.slice(0, 3).every(function (h) { return h.score >= 75; });
  }

  root.BPCore = {
    DIMENSIONS: DIMENSIONS,
    DIM_IDS: DIM_IDS,
    BANDS: BANDS,
    BAND_KEYS: BAND_KEYS,
    ADVICE: ADVICE,
    isValidAnswers: isValidAnswers,
    isValidContext: isValidContext,
    computeScore: computeScore,
    bandFor: bandFor,
    levelFor: levelFor,
    contextAdvice: contextAdvice,
    sustainedDepleted: sustainedDepleted
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
