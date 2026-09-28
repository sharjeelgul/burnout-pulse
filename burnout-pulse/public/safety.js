/* =====================================================================
   Burnout Pulse: safety module
   ---------------------------------------------------------------------
   ONE source of truth for crisis detection and crisis resources.
   Loaded by the browser as a classic <script> and by the server
   (api/coach.js) as a side-effect import. Both read globalThis.BPSafety,
   so the client and server checks cannot drift apart.

   Three tiers:
     "crisis"  - explicit first-person suicidal ideation, intent, plan,
                 or self-harm. The coach stops, never calls the model,
                 and shows crisis resources.
     "concern" - language that is ambiguous for a physician (e.g. "a
                 patient overdosed", "suicide rates", "I can't do this
                 anymore"). The conversation continues and a quiet
                 resource note is attached.
     "none"    - everything else.

   Keyword detection is a floor, not a clinical screen. It is paired
   with (1) a model system prompt that handles risk conservatively and
   (2) an output check on every model reply. See SAFETY.md.
   ===================================================================== */
(function (root) {
  "use strict";

  // Normalise so that iOS curly apostrophes, full-width characters,
  // zero-width joiners and repeated letters cannot slip past a match.
  function normalize(text) {
    var t = String(text == null ? "" : text);
    if (t.normalize) t = t.normalize("NFKC");
    t = t.toLowerCase()
      .replace(/[‘’‛ʼ′`´]/g, "'")
      .replace(/[​-‍⁠﻿­]/g, "")
      .replace(/[^a-z0-9'\s-]/g, " ")
      .replace(/-/g, " ")
      .replace(/(.)\1{2,}/g, "$1")     // "diiiie" -> "die" (English has no triple letters)
      .replace(/\s+/g, " ");
    return " " + t.trim() + " ";
  }

  // Second pass that undoes simple character substitution ("k1ll", "d1e").
  function deLeet(t) {
    return t.replace(/1/g, "i").replace(/3/g, "e").replace(/0/g, "o")
            .replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");
  }

  var AP = "'?"; // optional apostrophe
  var CRISIS = [
    /\bkill(ing)? ?my ?self\b/, /\bkms\b/, /\bunalive\b/,
    /\bend(ing)? (my|it) (life|all)\b/, /\bend it all\b/, /\bend things\b/,
    /\btake my (own )?life\b/, /\btaking my (own )?life\b/,
    /\b(i|i'm|im|i am) (want|wanna|going|gonna|planning|trying) (to )?(die|be dead)\b/,
    /\bwant(ed)? to die\b/, /\bwanna die\b/, /\bwish i (was|were) dead\b/,
    /\bbetter off dead\b/, /\bbetter off without me\b/, /\bbetter without me\b/,
    /\b(i'm|im|i am|feeling|feel|been|getting) (really |so |pretty |very )?suicidal\b/,
    /\bsuicidal (thoughts|ideation|feelings)\b/,
    /\b(thinking|thought|thoughts) (about|of) (suicide|killing myself|ending it|dying)\b/,
    /\bcommit(ting)? suicide\b/,
    /\b(harm|hurt|cut|cutting|burn|burning) ?my ?self\b/,
    /\b(i|i'm|im|i am|i've|ive|been|started|keep|urge to|want to|going to) (been )?self ?harm(ing)?\b/, /\bself ?harming again\b/,
    /\bno reason to (live|go on|keep going)\b/,
    new RegExp("\\bcan" + AP + "t go on\\b"), /\bcannot go on\b/,
    new RegExp("\\bdon" + AP + "t want to (be here|be alive|live|exist|wake up)\\b"),
    /\bdo not want to (be here|be alive|live|exist|wake up)\b/,
    /\bnot (want|wanting) to wake up\b/, /\bnever wake up\b/,
    /\b(want|wanna|hope|wish|rather)( i| to)? (not|never|don't|dont) (to )?wake up\b/,
    /\bno point (in )?(living|anymore|going on)\b/,
    new RegExp("\\b(i" + AP + "m|i am) (just )?a burden\\b"),
    /\bhow many (pills|tablets|mg) (would|will|does|do) it take\b/,
    /\b(hang|shoot|drown|poison) my ?self\b/,
    /\bjump(ing)? (off|in front of)\b/,
    /\boverdos(e|ing) on (my|the|some|all)\b/,
    /\bdisappear (forever|for good|permanently)\b/
  ];

  // Ambiguous for clinicians: attach resources, keep talking.
  var CONCERN = [
    /\bsuicid/, /\boverdos/, /\bself ?harm/, /\blethal dose\b/,
    new RegExp("\\bcan" + AP + "t do this anymore\\b"),
    new RegExp("\\bcan" + AP + "t keep (doing|going)\\b"),
    /\bhopeless\b/, /\bno way out\b/, /\bwant to disappear\b/,
    /\bgive up on (everything|life)\b/, /\bwhat'?s the point\b/,
    /\bnobody would (care|notice)\b/, /\bempty inside\b/
  ];

  function test(list, t) {
    for (var i = 0; i < list.length; i++) if (list[i].test(t)) return true;
    return false;
  }

  function classify(text) {
    var t = normalize(text);
    var tl = deLeet(t);
    if (test(CRISIS, t) || test(CRISIS, tl)) return "crisis";
    if (test(CONCERN, t) || test(CONCERN, tl)) return "concern";
    return "none";
  }

  // Resource order matters: 24/7 crisis services first. The Physician
  // Support Line is peer support, not a crisis line, and is closed
  // 1am-8am ET (verified against physiciansupportline.com/faq, 2026-09).
  var RESOURCES = [
    { id: "988", label: "988 Suicide & Crisis Lifeline", detail: "Call or text 988. 24/7, free, confidential.",
      href: "tel:988", display: "988" },
    { id: "911", label: "Immediate danger", detail: "Call 911 or go to the nearest emergency department.",
      href: "tel:911", display: "911" },
    { id: "ctl", label: "Crisis Text Line", detail: "Text HOME to 741741. 24/7.",
      href: "sms:741741?&body=HOME", display: "741741" },
    { id: "psl", label: "Physician Support Line", detail: "Peer support from volunteer psychiatrists for physicians and trainees. 8am–1am ET daily. Not a crisis line.",
      href: "tel:18884090141", display: "1-888-409-0141" }
  ];

  function institutionResources(cfg) {
    var out = [];
    if (cfg && cfg.resources && cfg.resources.length) {
      cfg.resources.forEach(function (r) {
        if (r && r.label && (r.phone || r.url)) out.push(r);
      });
    }
    return out;
  }

  var CRISIS_INTRO =
    "I'm going to stop here, because what you just said matters more than anything else in this conversation.\n\n" +
    "I'm an AI reflection tool. I'm not able to help with this the way a person can, and you deserve a person right now.";
  var CRISIS_OUTRO =
    "You don't need the right words. You can just call or text and say you saw this. If you can, tell one person near you, a colleague, a friend, your chief, that today is a bad day.";

  function crisisText() {
    var lines = RESOURCES.map(function (r) { return "• " + r.label + ": " + r.detail; });
    return CRISIS_INTRO + "\n\n" + lines.join("\n") + "\n\n" + CRISIS_OUTRO;
  }

  var CONCERN_NOTE =
    "If any of this is about you and not only about a patient: 988 (call or text) is open 24/7, and the Physician Support Line (1-888-409-0141, 8am–1am ET) is staffed by psychiatrists who work with doctors.";

  root.BPSafety = {
    version: "2026.09",
    normalize: normalize,
    classify: classify,
    RESOURCES: RESOURCES,
    institutionResources: institutionResources,
    CRISIS_INTRO: CRISIS_INTRO,
    CRISIS_OUTRO: CRISIS_OUTRO,
    CONCERN_NOTE: CONCERN_NOTE,
    crisisText: crisisText
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
