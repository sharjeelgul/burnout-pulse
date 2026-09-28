# Security

This document covers the threat model, the controls, the results of the independent penetration test run on v12, the retest on v13, and the controls a deploying institution still has to own.

## Threat model

| Actor | Goal | Primary control |
|---|---|---|
| Colleague at a shared workstation | Read someone's scores or coach notes | AES-256-GCM encryption at rest, PBKDF2 key from the passphrase, 15-minute idle lock, no auto-login |
| Anyone on the internet | Use the coach endpoint as a free LLM, or run up the deployer's bill | Origin allow-list, strict size and schema limits, per-client and per-instance rate limits, platform WAF rate rule, provider spend cap |
| Malicious input | Script injection | No untrusted `innerHTML`, strict CSP with no inline script or style, `frame-ancestors 'none'` |
| Prompt injection | Rewrite the coach's rules or safety behavior | Only allow-listed, server-derived values reach the system prompt; message text is treated as conversation; output is re-classified |
| The operator (the deployer) | Read users' data | Local-first design: in v13 the operator has no copy of check-ins or coach logs. With the live coach on, only messages the user sends pass through the function, and they are never logged. |

## Data flow (v13)

1. Check-ins, context, coach log, and preferences: encrypted in the browser. Never transmitted.
2. Live coach (opt-in, off by default): the message, up to 12 prior non-crisis turns, and allow-listed score context go to `/api/coach`, then to the AI provider. The user's name and email are never sent.
3. Crisis-tier messages: never transmitted, by the client or the server.
4. Fonts, scripts, and styles: same-origin only. No third-party requests, analytics, or cookies.

## Cryptography

- Key derivation uses PBKDF2-HMAC-SHA-256 with 600,000 iterations and a 16-byte random salt per account. This meets the OWASP Password Storage Cheat Sheet recommendation for PBKDF2-SHA-256.
- Encryption is AES-256-GCM with a fresh 96-bit IV on every write. The authentication tag doubles as passphrase verification.
- Passphrases must be at least 15 characters, are checked against a blocklist, and cannot contain the email. This follows NIST SP 800-63B for passwords used as a single factor.
- Record lookup uses a SHA-256 hash of the normalized email with a domain-separation prefix. Anyone with device access can confirm whether a specific email has a vault on that browser. They cannot read it.
- Limit: an attacker who copies the ciphertext can attack the passphrase offline. The 15-character minimum and 600k iterations make that expensive, not impossible. This is why the sign-in screen tells users to use a device they control.

## Penetration test results

The test ran 2026-09-27 against the unmodified v12 source and then against v13. Every attack is automated and replayable: `tests/e2e.mjs` covers A1 to A8, `tests/api.test.mjs` covers B1 to B8, and `tests/db_attack.sql` covers C1 to C9.

| ID | Finding (v12) | Severity | v12 result | v13 result |
|---|---|---|---|---|
| A1 | iOS curly apostrophe (`don’t want to be here`) bypassed crisis detection on client and server | Critical (patient safety) | Missed, no resources shown | Detected |
| A2 | Euphemisms (`kms`, `not wake up`, `how many pills would it take`) bypassed crisis detection | Critical (patient safety) | 3 of 3 missed | Detected |
| A3 | Crisis message listed the Physician Support Line first. It is not a crisis line and is closed 1am to 8am ET. | High (patient safety) | Wrong order, no hours | 988, 911, and Crisis Text Line first; PSL hours stated |
| A3b | Clinical words (`patient overdose`) triggered a full crisis stop | Medium (usability, alarm fatigue) | Crisis stop | Conversation continues with a resource note |
| A4 | Stored XSS via `innerHTML` in the toast (friend-email field) | High | `alert(1337)` executed | Rendered as text; CSP blocks inline script regardless |
| A5 | Passphrase stored as reversible Base64; all data in plaintext `localStorage` | Critical (confidentiality) | Passphrase and full coach log recovered | Ciphertext only |
| A6 | Setting `bp.active` in `localStorage` logged in as anyone without a passphrase | Critical (authentication) | Bypassed | Removed; the key exists only in memory |
| A7 | Sign-in messages revealed whether an email had an account | Low | Distinct messages | Identical message |
| A8 | A non-Latin-1 email crashed sign-up (`btoa`) | Low (availability) | Uncaught exception | Fixed |
| B1 | `/api/coach` accepted any origin with no rate limit (open relay) | High (financial abuse) | 50 of 50 accepted from `evil.example` | 403 on foreign or missing Origin; 429 after 20 per 10 min |
| B2 | Free text in `context.latestBand` injected into the system prompt | High (prompt injection) | Injected | Rejected; the band is derived server-side from the score |
| B3 | History was not size-limited; 2.4 MB forwarded upstream per request | High (financial abuse) | Forwarded | 400/413; history limited to 12 items and 12,000 characters |
| B4 | Client sent the current message twice (two consecutive `user` turns) | Medium (reliability) | Duplicated | Normalized to alternating roles |
| B5 | Non-string history content accepted | Low | 200 | 400 |
| B6 | Crisis text reached the model through the server's curly-apostrophe gap and through replayed history | Critical (privacy, safety) | Sent | Never sent; stripped from history on both sides |
| B7 | User's first name sent to the AI provider | Low (data minimization) | Sent | Not sent |
| B8 | Model output was only lightly checked | Medium | Resources appended | Crisis-tier output replaced with the crisis response |
| C1 | Cross-user reads (Supabase) | n/a | Blocked in v12 too | Blocked |
| C2 | Client-supplied score stored even when it contradicted the answers | Medium (integrity) | Score 0 stored for maximum answers | Recomputed by a database trigger |
| C3 | `request_friend(email)` confirmed whether any colleague had an account | High (privacy) | Enumerated | Function removed |
| C4 | Requester could insert a friendship already marked `accepted` | High (consent) | Bypassed | Feature removed |
| C5 | Unsolicited messages to any user after C3 and C4 | High | Injected | Feature removed |
| C6 | Leaderboard with latest score and handle; re-identifiable in small departments | High (privacy, psychological safety) | Exposed | Feature removed |
| C7 | PRIVACY.md promised account deletion, but no path existed | Medium (legal accuracy) | Permission denied | `delete_my_account()` RPC |
| C9 | Unbounded coach message body (5 MB accepted) | Low | Accepted | Limited to 4,000 characters |
| D1 | Google Fonts call leaked every visitor's IP to a third party, contradicting "nothing is sent anywhere" | Medium (privacy, legal accuracy) | Present | Fonts self-hosted |
| D2 | No Content-Security-Policy or HSTS | Medium | Missing | Strict CSP (header and meta), HSTS, COOP, CORP |

Retest summary: 23/23 unit and API tests, 18/18 end-to-end checks, and 5/5 database assertions pass. axe-core reports zero WCAG 2.1 AA violations across every view in light and dark mode.

## What the deploying institution must add

The code cannot do these, and a security review will ask for each:

1. Put the deployment behind institutional SSO (for example, Vercel password protection or the hospital's reverse proxy) for any pilot. This is the strongest single control on the coach endpoint.
2. Add a platform rate-limit rule, such as a Vercel WAF rule on `/api/coach` at 20 requests per 10 minutes per IP. In-memory limits are per warm instance only.
3. Set a monthly spend limit in the AI provider console.
4. Put the AI provider under a signed data-processing agreement with the retention and training terms your counsel requires, and set `aiProcessorName` in `public/config.js` to match.
5. Set `ALLOWED_ORIGINS` to the exact production origin.
6. Complete your institution's vendor security questionnaire. Universities commonly use HECVAT; health systems often use their own or SIG Lite.
7. Commission an external penetration test by an accredited firm before production. This document is a pre-assessment, not a substitute.

## Reporting a vulnerability

Email the maintainer listed in `TERMS.md`. Do not include real user data.
