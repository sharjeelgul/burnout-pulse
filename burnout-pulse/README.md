# Burnout Pulse

A private weekly check-in for physicians and surgeons: six questions, a trend over time, advice keyed to the answers, and an optional reflection coach. It takes about two minutes a week.

**Version 13.** This is the hardened rebuild of the v12 prototype after an independent penetration test and a multidisciplinary review. See `CHANGELOG.md` for what changed and why. **To host it, follow `SETUP_GUIDE.md`.**

## What it does

- **Check-in.** Six items (energy, detachment, sense of efficacy, control, recovery, dread about the next shift, case, or call). Each has its own five-point answer scale, and every item is worded so that a higher answer means more strain. The answers become a 0 to 100 score.
- **This week in surgery (optional, not scored).** Hours worked, nights on call, and whether a complication or patient outcome is weighing on you. These tailor the advice: hours above 80 bring up the ACGME limit, three or more call nights bring up sleep debt, and an adverse event brings up second-victim support.
- **Trend.** Chart and history, the three most strained dimensions first, and crisis resources moved to the top when the score is in the depleted range. Three depleted check-ins in a row bring up a direct prompt to talk to a person.
- **Coach.** Offline reflection prompts by default. The live AI coach is opt-in, behind a consent screen, and always labeled as AI. Crisis messages stop the coach, show 24/7 resources, and are never sent anywhere. See `SAFETY.md`.
- **Settings.** Download your data, clear the coach history, change your passphrase, and delete your account.

## What it is not

It is not a diagnostic instrument, not the Maslach Burnout Inventory, not validated, and not a clinician. It cannot contact anyone. See `TERMS.md`.

## Privacy by architecture

Everything is encrypted in the browser (AES-256-GCM, with a key derived from a PBKDF2 passphrase at 600k iterations) and never leaves the device. The only exception is the text a user chooses to send to the live coach. There are no third-party requests, analytics, or cookies. The operator holds no user data. See `PRIVACY.md` and `SECURITY.md`.

## Run it

```
open public/index.html   # offline mode: everything works except the live coach
npm run dev              # local server for public/
```

## Configure it

Edit `public/config.js` for institution name, institution support resources, idle-lock minutes, the coach endpoint (set it to `""` to disable the live coach entirely), and retention limits.

Server environment variables (see `.env.example`): `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`, `COACH_MODEL`, `COACH_RATE_PER_10MIN`, `COACH_DAILY_CAP`.

## Test it

```
npm test                 # 23 unit + API tests, including the API pen-test replay
npm run test:e2e         # 18 browser checks: client pen-test replay, migration, axe WCAG 2.1 AA
npm run test:db          # schema pen-test replay against Postgres (needs psql)
```

`test:e2e` needs Playwright (`npm i -D playwright`). For the accessibility scan, set `AXE_PATH` to `axe.min.js` from the `axe-core` package.

## Files

```
public/                            everything served to visitors (Vercel outputDirectory)
  index.html styles.css app.js     the app (no build step; strict CSP, no inline code)
  safety.js                        crisis detection and resources, shared by the browser and the server
  core.js                          instrument, scoring, and advice, shared by the browser and the server
  config.js                        per-institution settings
  privacy.html terms.html safety.html   rendered from the .md files by `npm run docs`
  fonts/                           self-hosted Fraunces and Epilogue (SIL OFL)
api/coach.js                       live coach endpoint (optional)
supabase/                          phase-2 server schema (not wired to the app; tested separately)
tests/  tools/                     test suites and the docs renderer (never served)
SETUP_GUIDE.md                     step-by-step hosting on a Mac
SECURITY.md SAFETY.md PRIVACY.md TERMS.md ACCESSIBILITY.md CHANGELOG.md
```

## Upgrading from v12

Existing v12 users sign in as usual. On first sign-in their data is moved into encrypted storage, and every legacy plaintext key, including the Base64 passphrase, is deleted. The v12 leaderboard and friends features are retired (see `CHANGELOG.md`).
