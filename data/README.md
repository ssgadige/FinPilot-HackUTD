# Synthetic data

Run python scripts/seed_demo.py, then python scripts/validate_seed.py. Produces a local SQLite database, demo credentials and seed manifest (all gitignored). Thirty complete calendar months: May 2024 through October 2026; as-of date November 7, 2026. More than two years of history for every persona. Financial variations are seeded pseudorandomly; passwords/salts are cryptographically random and differ on reset.

All identities are fictional; example.test email addresses are reserved test values. Ten distinct application logins; three distinct institution logins per person. Seed is a development starter; application authentication/linking are implementation tickets. Institutions start unlinked, so dashboard/agents should see no account history until consented linking. Data is held in the simulator database and becomes accessible through scoped connection selection.

Thirty months of historical expenses/income include synthetic categories, subscriptions/price changes, paired asset transfers and credit-card payments. Opening balances plus transactions reconcile to stored current balances. Monthly liability interest entries are simplified synthetic ledger events; not real bank statements or tax records. Investment valuations are snapshots, not market feeds.

Demo credentials live only in data/demo-credentials.json. The seed verifies app/institution passwords through scrypt hashes; it never stores plaintext in SQLite. Use local Mailpit for example.test OTP delivery. Never deploy these public demo credentials for real data. Reset only a disposable local DB via --reset.
