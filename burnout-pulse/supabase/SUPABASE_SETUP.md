# Server schema (phase 2)

**The v13 app does not use this.** v13 is local-first, and the operator holds no user data. That is the lowest-risk design for a pilot, and it is what reviewers should evaluate.

`schema.sql` is the hardened design for a later phase, if an institution decides it wants cross-device sync. It has been tested against Postgres 16 with a Supabase auth shim (`npm run test:db`), including a replay of every v12 database attack. It has not been tested against a live Supabase project, and the client code to use it has not been written.

## Before anyone builds phase 2

A server-backed version changes the legal and security posture, so decide these first:

1. **Who hosts it.** For a hospital, it should be the institution's own environment, or a vendor under the institution's contract with a BAA or DPA as counsel requires. Not a personal free-tier account.
2. **Who can access the data.** Server-side wellbeing data about employees can be requested in litigation and can raise employment-law confidentiality questions (for example, the ADA's rules on keeping employee medical information confidential). Counsel should settle access, retention, and discoverability before any data is stored.
3. **Encryption model.** The preferred design keeps client-side encryption and stores only ciphertext on the server, so even a server breach exposes nothing readable. `schema.sql` stores plaintext answers and would need to change for that model.
4. **Retention.** Schedule `purge_old_coach_messages()` with `pg_cron`.

## Running the schema

In a new project's SQL editor, run `schema.sql`. It is idempotent, and it removes the v12 friendships, messages, and leaderboard objects if they exist. Keep email confirmation turned on. Never ship the `service_role` key to a browser.

## Verify

`npm run test:db` against a disposable Postgres. Then, on the real project, repeat the checks with two real accounts: A cannot read B, forged scores are recomputed, and `delete_my_account()` removes everything.
