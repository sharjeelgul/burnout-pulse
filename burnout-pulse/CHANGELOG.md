# Changelog

## 13.0.0 (2026-09-27)

Hardened rebuild after an independent penetration test and a multidisciplinary review (see `SECURITY.md`).

### Packaging
- Served files moved into `public/`, so repository files (tests, schema, docs) are never exposed and deployment no longer depends on hidden files that Finder won't copy.
- Removed the function `memory` setting, which Vercel rejects when Fluid compute is on.
- Privacy, terms, and safety are rendered as in-app pages that open in a new tab.
- New step-by-step Mac hosting guide.

### Safety
- One shared safety module (`safety.js`) for the browser and the server, so the two checks can no longer drift apart.
- Fixed crisis-detection bypasses: iOS curly apostrophes, euphemisms ("kms", "not wake up", "how many pills would it take"), zero-width and full-width characters, repeated letters, and digit substitution.
- Three tiers. Clinical language such as "a patient overdosed" no longer stops the conversation; it attaches a resource note instead.
- Crisis resources reordered: 988, 911, and Crisis Text Line (all 24/7) first. The Physician Support Line is listed with its real hours (8am to 1am ET) and marked as not a crisis line.
- Crisis messages are never sent to the AI provider and never replayed in later context.
- AI disclosure at the start of every coach session and every three hours. Replies are labeled "Coach (AI)" or "Offline prompt". A published safety protocol (`SAFETY.md`).
- Resources move to the top of Trend when the score is depleted; three depleted check-ins in a row bring up a direct prompt.

### Security and privacy
- Local data encrypted at rest (AES-256-GCM, PBKDF2-SHA-256 at 600k iterations). Removed the Base64 passphrase and the `bp.active` passwordless auto-login.
- 15-character passphrase minimum with a blocklist; idle lock; change passphrase; export; delete account.
- Automatic, one-time migration of v12 data, followed by deletion of every plaintext key.
- Coach API: origin allow-list, rate limits, strict schema and size limits, prompt-injection-proof context, history normalization, upstream timeout, output re-classification, no content logging.
- Strict CSP with no inline script or style, plus HSTS, COOP, CORP, and a tightened Permissions-Policy. Fonts self-hosted: no third-party requests at all.
- The live coach is opt-in behind a consent screen. Name and email are never sent.
- Fixed stored XSS in toasts.

### Removed
- **Leaderboard.** Ranking colleagues by burnout score undermines psychological safety, and handle plus score plus timing can re-identify people in a small department. In v12 it was also local-only, so each user only ever saw themselves.
- **Friends and chat.** In v12 it was single-device, so messages never reached the friend. The server design allowed user enumeration, adding friends without consent, and unsolicited messaging. Peer messaging about mental health also raises retention and discoverability questions an institution would need to settle first.

### Clinical and design
- Items reworded so each has matching answer anchors and higher always means more strain. "How the score works" explains that the bands are not clinical cut-offs.
- Optional "This week in surgery" context (hours, call nights, adverse event), with ACGME, sleep-debt, and second-victim advice. Institution resources are configurable.
- WCAG 2.1 AA: new palette with every pair measured, real form semantics, ARIA tabs, live regions, skip link, 44px targets, dark mode, forced colors, and reduced motion. axe-core reports zero violations.
- Removed the splash screen, film grain, ambient sound, and breathing animation. Advice leads with the top three strained dimensions and folds away the rest.

### Server schema (phase 2, not wired to the app)
- Dropped friendships, messages, and the leaderboard; the database computes scores; field bounds; self-service `delete_my_account()`; retention purge; forced RLS; least-privilege grants. Tested against Postgres 16.

## 12.x
Prototype. Local-only storage, keyword crisis check, leaderboard, and single-device friends chat. Supabase schema written but the client was never wired to it.
