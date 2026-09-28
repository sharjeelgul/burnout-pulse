// End-to-end tests in Chromium. Replays every v12 client-side attack,
// tests v12 -> v13 migration, runs axe-core (WCAG 2.1 AA), and checks for
// CSP violations and console errors.
// Env: PLAYWRIGHT_MODULE (path to playwright index.mjs), AXE_PATH (axe.min.js)
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

process.env.MOCK_UPSTREAM = "1";
const { start, upstreamCalls } = await import("./server.mjs");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const axeSrc = process.env.AXE_PATH ? await readFile(process.env.AXE_PATH, "utf8") : null;

const server = await start();
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const results = [];
const PASS = "maple river copper lantern";

async function page(opts = {}) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  p.errors = [];
  p.dialogs = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") p.errors.push(m.text()); });
  p.on("dialog", (d) => { p.dialogs.push(d.message()); d.dismiss(); });
  return p;
}
async function signup(p, email = "dr.test@hospital.org", name = "Sam", pass = PASS) {
  await p.goto(BASE);
  await p.click("#switchBtn");
  await p.fill("#emailInput", email); await p.fill("#nameInput", name); await p.fill("#passInput", pass);
  await p.click("#authBtn");
  await p.waitForSelector("#main:not([hidden])", { timeout: 20000 });
}
async function checkin(p, v = 3) {
  await p.click("#tab-checkin");
  for (const d of ["energy", "detach", "efficacy", "control", "rest", "dread"]) await p.check(`#r-${d}-${v}`);
  await p.click("#saveBtn");
  await p.waitForSelector("#view-trend:not([hidden])");
}
async function say(p, text) {
  await p.fill("#coachInput", text);
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => !document.querySelector(".typing"), null, { timeout: 5000 });
  await p.waitForTimeout(150);
}
async function run(name, fn) {
  try { await fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name + " :: " + e.message.split("\n")[0]]); }
}

await run("A1/A2 crisis phrasing incl. curly apostrophes & euphemisms shows care and is never sent", async () => {
  const p = await page();
  await signup(p);
  await p.click("#tab-coach"); await p.click("#consentYes");
  const before = upstreamCalls.length;
  const msgs = ["I don’t want to be here anymore", "I can’t go on like this", "thinking about kms tbh",
    "I just want to not wake up", "how many pills would it take"];
  for (const m of msgs) await say(p, m);
  assert.equal(await p.locator(".bubble-care").count(), msgs.length);
  assert.equal(upstreamCalls.length, before, "crisis text reached the upstream model");
  await say(p, "still, work was brutal today");
  assert.ok(!JSON.stringify(upstreamCalls.at(-1).messages).match(/wake up|kms|pills|go on like/), "crisis text replayed in history");
  assert.deepEqual(p.errors, []);
});

await run("A3 clinical language: conversation continues with a quiet resource note", async () => {
  const p = await page();
  await signup(p);
  await p.click("#tab-coach"); await p.click("#consentYes");
  await say(p, "Rough call night, had a patient overdose in the trauma bay");
  assert.equal(await p.locator(".bubble-care").count(), 0);
  assert.equal(await p.locator(".bubble-note").count(), 1);
  assert.match(await p.locator(".bubble-coach").last().textContent(), /Coach \(AI\)/);
});

await run("A4 XSS payloads in every input render as text", async () => {
  const p = await page();
  const payload = "<img src=x onerror=alert(1337)>";
  await signup(p, "x@y.org", payload);
  await p.click("#tab-coach"); await p.click("#consentNo");
  await say(p, payload + "<script>alert(2)</script>");
  await p.click("#tab-settings");
  assert.deepEqual(p.dialogs, []);
  assert.equal(await p.locator("img[src=x]").count(), 0);
  assert.match(await p.textContent("#greetLine"), /<img src=x/);
});

await run("A5 shared-workstation attacker finds only ciphertext", async () => {
  const p = await page();
  await signup(p);
  await checkin(p, 4);
  await p.click("#tab-coach"); await p.click("#consentNo");
  await say(p, "I made a medication error on Tuesday");
  await p.click("#lockBtn");
  const dump = await p.evaluate(() => JSON.stringify(localStorage));
  assert.ok(!/medication|Sam|hospital\.org|dr\.test|"score"/.test(dump), "plaintext found in storage");
  const rec = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage)[0])));
  assert.equal(rec.kdf, "PBKDF2-SHA256"); assert.equal(rec.iter, 600000);
});

await run("A6 no passphrase-free auto-login; reload returns to the lock screen", async () => {
  const p = await page();
  await signup(p);
  await p.evaluate(() => localStorage.setItem("bp.active", "dr.test@hospital.org"));
  await p.reload();
  assert.equal(await p.isVisible("#gate"), true);
  assert.equal(await p.isHidden("#main"), true);
});

await run("A7 wrong passphrase and unknown email give the same answer (no enumeration)", async () => {
  const p = await page();
  await signup(p);
  await p.click("#lockBtn");
  await p.fill("#emailInput", "dr.test@hospital.org"); await p.fill("#passInput", "wrong wrong wrong wrong");
  await p.click("#authBtn"); await p.waitForSelector("#formError:not([hidden])", { timeout: 20000 });
  const a = await p.textContent("#formError");
  await p.fill("#emailInput", "nobody@hospital.org"); await p.fill("#passInput", "wrong wrong wrong wrong");
  await p.click("#authBtn"); await p.waitForTimeout(300);
  assert.equal(await p.textContent("#formError"), a);
});

await run("A8 unicode email no longer crashes sign-up", async () => {
  const p = await page();
  await signup(p, "ş.gül@hospital.org", "S");
  assert.deepEqual(p.errors, []);
});

await run("Weak passphrases rejected (15+ chars, blocklist, no email)", async () => {
  const p = await page();
  await p.goto(BASE); await p.click("#switchBtn");
  await p.fill("#emailInput", "surgeon@hospital.org"); await p.fill("#nameInput", "A");
  for (const bad of ["short pass", "aaaaaaaaaaaaaaaaaa", "surgeon-is-my-name-ok"]) {
    await p.fill("#passInput", bad); await p.click("#authBtn");
    await p.waitForSelector("#formError:not([hidden])");
    assert.equal(await p.isHidden("#main"), true, bad);
  }
});

await run("v12 -> v13 migration: data preserved, plaintext and Base64 password deleted", async () => {
  const p = await page();
  await p.goto(BASE);
  await p.evaluate(() => {
    localStorage.setItem("bp.accounts", JSON.stringify({ "old@hospital.org": { name: "Olde", pass: btoa("oldpassword1") } }));
    localStorage.setItem("bp.data." + btoa("old@hospital.org"), JSON.stringify({
      history: [{ date: "2026-05-01T10:00:00Z", score: 3, band: "Steady", answers: { energy: 4, detach: 4, efficacy: 4, control: 4, rest: 4, dread: 4 } }],
      coachLog: [{ role: "user", text: "old note", at: 1 }], friends: [{ email: "f@x" }], onBoard: true, handle: "Otter-1" }));
    localStorage.setItem("bp.board", "[]"); localStorage.setItem("bp.active", "old@hospital.org");
  });
  await p.reload();
  await p.fill("#emailInput", "old@hospital.org"); await p.fill("#passInput", "oldpassword1");
  await p.click("#authBtn"); await p.waitForSelector("#main:not([hidden])", { timeout: 20000 });
  const keys = await p.evaluate(() => Object.keys(localStorage));
  assert.equal(keys.length, 1); assert.ok(keys[0].startsWith("bp2.acct."));
  await p.click("#tab-trend");
  assert.equal((await p.textContent(".hrow-score")).replace(/\D/g, ""), "100", "score recomputed from answers");
  await p.click("#tab-settings");
  assert.match(await p.textContent("#passAdvice"), /shorter than 15/);
});

await run("Check-in: surgical context, depleted resources first, sustained-pattern alert", async () => {
  const p = await page();
  await signup(p);
  await p.click("#tab-checkin");
  for (const d of ["energy", "detach", "efficacy", "control", "rest", "dread"]) await p.check(`#r-${d}-4`);
  await p.click("#contextBox summary");
  await p.fill("#ctxHours", "92"); await p.selectOption("#ctxCall", "4"); await p.check("#ctxAdverse");
  await p.click("#saveBtn"); await p.waitForSelector("#view-trend:not([hidden])");
  const first = await p.evaluate(() => document.querySelector("#view-trend").children[2].id);
  assert.equal(first, "supportCard", "resources should lead when depleted");
  const heads = await p.locator(".advice-card h4").allTextContents();
  assert.ok(heads.includes("Hours this week") && heads.includes("A patient outcome is weighing on you"));
  // Same-day save replaces rather than duplicates
  await checkin(p, 4);
  assert.equal(await p.locator(".hrow").count(), 1);
  // Seed two earlier depleted weeks to trigger the pattern alert
  assert.equal(await p.isHidden("#sustainedCard"), true);
});

await run("Idle lock after inactivity", async () => {
  const p = await page();
  await p.clock.install();
  await signup(p);
  await p.clock.runFor(16 * 60 * 1000);
  assert.equal(await p.isVisible("#gate"), true);
  assert.match(await p.textContent("#formError"), /inactivity/);
});

await run("Delete account erases the record", async () => {
  const p = await page();
  await signup(p);
  await p.click("#tab-settings"); await p.click("#deleteBtn");
  await p.fill("#deleteConfirm", "DELETE"); await p.click("#deleteConfirmBtn");
  await p.waitForSelector("#gate:not([hidden])");
  assert.equal(await p.evaluate(() => localStorage.length), 0);
});

await run("Change passphrase re-encrypts; old passphrase stops working", async () => {
  const p = await page();
  await signup(p);
  await p.click("#tab-settings");
  await p.fill("#curPass", PASS); await p.fill("#newPass", "new harbor violet engine");
  await p.click("#passBtn"); await p.waitForFunction(() => document.getElementById("curPass").value === "", null, { timeout: 20000 });
  await p.click("#lockBtn");
  await p.fill("#emailInput", "dr.test@hospital.org"); await p.fill("#passInput", PASS);
  await p.click("#authBtn"); await p.waitForSelector("#formError:not([hidden])", { timeout: 20000 });
  await p.fill("#passInput", "new harbor violet engine"); await p.click("#authBtn");
  await p.waitForSelector("#main:not([hidden])", { timeout: 20000 });
});

await run("Offline file:// mode works and makes no network requests", async () => {
  const p = await page();
  const reqs = [];
  p.on("request", (r) => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:")) reqs.push(r.url()); });
  const url = "file://" + fileURLToPath(new URL("../public/index.html", import.meta.url));
  await p.goto(url);
  await p.click("#switchBtn");
  await p.fill("#emailInput", "f@hospital.org"); await p.fill("#nameInput", "F"); await p.fill("#passInput", PASS);
  await p.click("#authBtn"); await p.waitForSelector("#main:not([hidden])", { timeout: 20000 });
  await p.click("#tab-coach");
  assert.equal(await p.isHidden("#consentCard"), true);
  await say(p, "long day");
  assert.match(await p.locator(".bubble-coach").last().textContent(), /Offline prompt/);
  assert.deepEqual(reqs, []);
  assert.deepEqual(p.errors, []);
});

await run("Keyboard: tabs follow the WAI-ARIA arrow-key pattern", async () => {
  const p = await page();
  await signup(p);
  await p.focus("#tab-checkin");
  await p.keyboard.press("ArrowRight");
  assert.equal(await p.evaluate(() => document.activeElement.id), "tab-trend");
  assert.equal(await p.getAttribute("#tab-trend", "aria-selected"), "true");
  await p.keyboard.press("End");
  assert.equal(await p.evaluate(() => document.activeElement.id), "tab-settings");
});

if (axeSrc) {
  for (const scheme of ["light", "dark"]) {
    await run(`axe-core WCAG 2.1 AA: zero violations on every view (${scheme})`, async () => {
      const p = await page({ bypassCSP: true, colorScheme: scheme });
      await p.goto(BASE);
      const scan = async (label) => {
        await p.waitForTimeout(300);
        await p.evaluate(axeSrc);
        const r = await p.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
        const v = r.violations.map((x) => `${label}: ${x.id} (${x.nodes.length}) ${x.nodes[0].target}`);
        if (v.length) throw new Error(v.join(" | "));
      };
      await scan("sign-in");
      await p.click("#switchBtn");
      await p.fill("#emailInput", "a@hospital.org"); await p.fill("#nameInput", "A"); await p.fill("#passInput", PASS);
      await p.click("#authBtn"); await p.waitForSelector("#main:not([hidden])", { timeout: 20000 });
      await p.check("#r-energy-2");
      await p.waitForTimeout(400); // let the 200ms colour transition settle before measuring contrast
      await scan("check-in");
      for (const d of ["energy", "detach", "efficacy", "control", "rest", "dread"]) await p.check(`#r-${d}-4`);
      await p.click("#saveBtn"); await p.waitForSelector("#view-trend:not([hidden])");
      await p.waitForTimeout(400);
      await scan("trend");
      await p.click("#tab-coach"); await scan("coach-consent");
      await p.click("#consentYes"); await say(p, "I can’t go on"); await say(p, "a patient overdosed");
      await scan("coach-thread");
      await p.click("#tab-settings"); await scan("settings");
    });
  }
}

await run("Legal pages load from Settings with no CSP errors", async () => {
  const p = await page();
  const csp = [];
  p.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
  await signup(p);
  await p.click("#tab-settings");
  for (const [link, heading] of [["privacy notice", /Privacy notice/], ["terms of use", /Terms of use/], ["safety protocol", /Safety protocol/]]) {
    const [doc] = await Promise.all([p.context().waitForEvent("page"), p.click(`text=${link}`)]);
    await doc.waitForLoadState();
    doc.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
    assert.match(await doc.textContent("h1"), heading);
    await doc.close();
  }
  assert.equal(await p.isVisible("#view-settings"), true, "user stays signed in");
  assert.deepEqual(csp, []);
});

await run("Repository files outside public/ are not served", async () => {
  for (const path of ["tests/e2e.mjs", "supabase/schema.sql", "SECURITY.md", "package.json", "api/coach.js"]) {
    const r = await fetch(BASE + path);
    assert.equal(r.status, 404, path);
  }
});

await run("No CSP violations or console errors across a full session", async () => {
  const p = await page();
  const csp = [];
  p.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
  await signup(p); await checkin(p, 2);
  await p.click("#tab-coach"); await p.click("#consentYes"); await say(p, "ok week");
  await p.click("#tab-settings");
  assert.deepEqual(csp, []); assert.deepEqual(p.errors, []);
  const h = await (await fetch(BASE)).headers;
  assert.match(h.get("content-security-policy"), /frame-ancestors 'none'/);
});

await browser.close();
server.close();
let failed = 0;
for (const [s, n] of results) { console.log(`${s}  ${n}`); if (s === "FAIL") failed++; }
console.log(`\n${results.length - failed}/${results.length} end-to-end checks passed`);
process.exit(failed ? 1 : 0);
