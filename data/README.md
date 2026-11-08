# Synthetic data

Run python scripts/seed_demo.py, then python scripts/validate_seed.py. Produces a local SQLite database, demo credentials and seed manifest (all gitignored). Thirty complete calendar months: May 2024 through October 2026; as-of date November 7, 2026. More than two years of history for every persona. Financial variations are seeded pseudorandomly; passwords are intentionally `123` for every synthetic app and institution login; hash salts remain cryptographically random. These fixed credentials apply only to disposable demo data.

All identities are fictional; mail.finpilot.test email addresses are reserved test values. Ten distinct application logins; three distinct institution logins per person. Seed is a development starter; application authentication/linking are implementation tickets. Institutions start unlinked, so dashboard/agents should see no account history until consented linking. Data is held in the simulator database and becomes accessible through scoped connection selection.

Thirty months of historical expenses/income include synthetic categories, subscriptions/price changes, paired asset transfers and credit-card payments. Opening balances plus transactions reconcile to stored current balances. Monthly liability interest entries are simplified synthetic ledger events; not real bank statements or tax records. Investment valuations are snapshots, not market feeds.

Demo credentials live only in data/demo-credentials.json. The seed verifies app/institution passwords through scrypt hashes; it never stores plaintext in SQLite. Use local Mailpit for mail.finpilot.test OTP delivery. Never deploy these public demo credentials for real data. Reset only a disposable local DB via --reset.

## Demo sign-in and email delivery

Use each person's same email for FinPilot and each institution simulator, with password `123`. Institution lookup must include institution_id because the same email is used at several providers. Separate salted hashes are stored for each login. This does not relax any production password policy.

Examples: `maya.chen@mail.finpilot.test`, `jordan.brooks@mail.finpilot.test`, `priya.shah@mail.finpilot.test`. All ten email addresses are in the locally generated credentials file. Existing seed databases retain old credentials until explicitly regenerated; do not reset a teammate's database without coordinating.

Verification metadata is included in the credentials manifest: recipient equals the login email; FinPilot sender is `FinPilot Demo <security@finpilot.test>`; provider senders use names such as `Chase Simulator <verification@chase.finpilot.test>`. Route these messages only through local Mailpit. The sender domains are simulated and do not impersonate actual bank domains. This seed change does not implement SMTP, OTP generation or verification. FP-10/FP-11 must use fresh expiring single-use codes, never `123` as an OTP, and enforce scope by user and institution.
