import test from "node:test";
import assert from "node:assert/strict";
import "../public/safety.js";
import "../public/core.js";

const S = globalThis.BPSafety;
const C = globalThis.BPCore;

test("crisis: explicit first-person statements", () => {
  const cases = [
    "I want to kill myself", "thinking about kms tbh", "I just want to end it all",
    "everyone would be better off without me", "I'm suicidal", "i've been having suicidal thoughts",
    "I keep thinking about suicide", "I don't want to be here anymore", "I can't go on",
    "I don't want to wake up tomorrow", "I just want to not wake up", "I hope I never wake up", "how many pills would it take", "I've been cutting myself again",
    "honestly I want to die", "i wanna die", "I'm just a burden", "no reason to live",
    "I want to take my own life", "going to hang myself", "I want to unalive myself"
  ];
  for (const c of cases) assert.equal(S.classify(c), "crisis", c);
});

test("crisis: iOS curly apostrophes and other evasions (v12 missed these)", () => {
  assert.equal(S.classify("I don’t want to be here anymore"), "crisis");
  assert.equal(S.classify("I can’t go on like this"), "crisis");
  assert.equal(S.classify("I donʼt want to live"), "crisis");
  assert.equal(S.classify("k1ll mys3lf"), "crisis");
  assert.equal(S.classify("I want to diiiiie"), "crisis");
  assert.equal(S.classify("KILL MYSELF"), "crisis");
  assert.equal(S.classify("kill​myself"), "crisis");
  assert.equal(S.classify("I’ve been self-harming again"), "crisis");
  assert.equal(S.classify("I have the urge to self harm"), "crisis");
  assert.equal(S.classify("ｋｉｌｌ ｍｙｓｅｌｆ"), "crisis");
});

test("concern: clinical language keeps the conversation going", () => {
  for (const c of ["had a patient overdose in the trauma bay", "reading about physician suicide rates",
    "consulted on a self-harm patient", "I can't do this anymore", "what's the point", "feeling hopeless about the rota"]) {
    assert.equal(S.classify(c), "concern", c);
  }
});

test("none: ordinary hard days", () => {
  for (const c of ["long call, exhausted", "my attending killed me in the OR today lol", "this case is killing me",
    "dying to get some sleep", "I could kill for a coffee", "the patient died after a long code, rough night", "", null]) {
    assert.equal(S.classify(c), "none", String(c));
  }
});

test("resources: 24/7 crisis services come before the Physician Support Line", () => {
  const ids = S.RESOURCES.map((r) => r.id);
  assert.deepEqual(ids.slice(0, 3), ["988", "911", "ctl"]);
  const psl = S.RESOURCES.find((r) => r.id === "psl");
  assert.match(psl.detail, /8am.*1am ET/);
  assert.match(psl.detail, /Not a crisis line/);
});

test("scoring: range, rounding, and completeness", () => {
  const all = (v) => Object.fromEntries(C.DIM_IDS.map((k) => [k, v]));
  assert.equal(C.computeScore(all(0)), 0);
  assert.equal(C.computeScore(all(4)), 100);
  assert.equal(C.computeScore(all(2)), 50);
  assert.equal(C.computeScore({ energy: 4 }), null);
  assert.equal(C.computeScore({ ...all(0), extra: 4 }), null, "stray keys rejected");
  assert.equal(C.computeScore({ ...all(0), energy: 7 }), null, "out-of-range rejected");
  assert.equal(C.computeScore({ ...all(0), energy: 1.5 }), null);
});

test("bands and pattern detection", () => {
  assert.equal(C.bandFor(24).key, "steady");
  assert.equal(C.bandFor(25).key, "strained");
  assert.equal(C.bandFor(74).key, "heavy");
  assert.equal(C.bandFor(75).key, "depleted");
  assert.equal(C.sustainedDepleted([{ score: 80 }, { score: 76 }, { score: 90 }]), true);
  assert.equal(C.sustainedDepleted([{ score: 80 }, { score: 60 }, { score: 90 }]), false);
});

test("every item has five anchors, all worded so higher = worse", () => {
  for (const d of C.DIMENSIONS) {
    assert.equal(d.anchors.length, 5, d.id);
    assert.ok(C.ADVICE[d.id].ok && C.ADVICE[d.id].strained, d.id);
  }
});

test("surgical context advice", () => {
  const ids = C.contextAdvice({ hours: 88, callNights: 3, adverseEvent: true }).map((a) => a.id);
  assert.deepEqual(ids, ["hours", "call", "adverse"]);
  assert.equal(C.contextAdvice({ hours: 60 }).length, 0);
  assert.equal(C.isValidContext({ hours: 200 }), false);
  assert.equal(C.isValidContext({ callNights: 3, adverseEvent: true }), true);
});
