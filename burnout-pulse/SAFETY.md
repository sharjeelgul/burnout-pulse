# Safety protocol

This is the published crisis protocol for Burnout Pulse. Several state chatbot laws require operators of conversational AI to publish their self-harm and suicide protocol and to disclose that the user is talking to an AI. Examples are California SB 243 (effective January 1, 2026) and New York General Business Law Article 47 (effective November 5, 2025). Whether a given deployment falls under a particular statute is a question for the deploying institution's counsel. This protocol is written to meet the stricter of them either way.

## What the coach is

- **Live AI coach:** off by default, and turned on only after a consent screen that names the AI provider and what is sent. Every coach reply is labeled "Coach (AI)".
- **Offline prompts:** simple reflection prompts that run on the device. They are not AI, and every reply is labeled "Offline prompt".
- A disclosure that the user is not talking to a person appears at the start of every coach session and again after three hours of continued use.
- The coach does not diagnose, treat, assess risk, advise on medication, or give clinical advice about patients. It never presents itself as a clinician, therapist, or counselor.

## Detection

Every message is classified by `safety.js`, the same code in the browser and on the server, into three tiers:

| Tier | Examples | What happens |
|---|---|---|
| Crisis | First-person suicidal ideation, intent, or plan; self-harm; "I don't want to wake up"; asking how many pills it would take | The coach stops. No generated reply. The crisis resources block is shown. The message is **never sent** to the AI provider and is excluded from all future context. |
| Concern | Clinically ambiguous language: "patient overdosed", "suicide rates", "I can't do this anymore", "hopeless" | The conversation continues, and a short resource note is attached below the reply. |
| None | Everything else, including dark humor ("this case is killing me") | Normal conversation. |

Normalization defeats common evasions: iOS curly apostrophes, full-width characters, zero-width characters, repeated letters ("diiiie"), and simple digit substitution ("k1ll").

Each model reply is classified again on the server. A reply at crisis tier is replaced with the crisis response.

## Crisis resources and their order

1. **988 Suicide & Crisis Lifeline**: call or text 988, available 24/7.
2. **911**, or the nearest emergency department, for immediate danger.
3. **Crisis Text Line**: text HOME to 741741, available 24/7.
4. **Physician Support Line**: 1-888-409-0141. Peer support from volunteer psychiatrists, 8am to 1am ET daily. It is not a crisis line, so it is listed last. (Hours verified at physiciansupportline.com/faq, September 2026.)
5. Institution-specific resources set in `public/config.js`, such as peer support after adverse events or the employee assistance program.

## Limits, stated plainly

- Keyword detection is a floor, not a clinical screen. It will miss some ways of expressing risk and will flag some statements that aren't risk. The system prompt instructs the model to respond conservatively to any risk signal as a second layer.
- The app **cannot contact anyone**. It does not alert a program director, employer, or emergency services, and it says so to the user. This is deliberate: confidentiality is what makes an honest check-in possible. Any institution that wants escalation must design it with its own clinical governance, not bolt it onto this tool.
- The tool is intended for adult physicians and trainees. It is not designed for minors.

## Review and change control

- The safety rules are versioned (`BPSafety.version`, shown in Settings).
- Every change to `safety.js` must pass `tests/unit.test.mjs` and `tests/api.test.mjs`. Every phrase that was ever missed is added to the test suite as a regression case.
- A deploying institution should name a clinical safety owner, a psychiatrist or a clinician from the wellbeing program, to review this protocol before launch and at least every six months after.
- Where a statute requires annual reporting (California SB 243 requires reports to the Office of Suicide Prevention), the operator counts crisis-tier events. Because v13 is local-first, the operator has no count by default. A deployment that must report needs an anonymous, opt-in counter designed with counsel.
