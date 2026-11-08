# Synthetic data

Run python scripts/seed_demo.py, then python scripts/validate_seed.py. Produces a local SQLite database, demo credentials and seed manifest (all gitignored). Thirty complete calendar months: May 2024 through October 2026; as-of date November 7, 2026. More than two years of history for every persona. Financial variations are seeded pseudorandomly; all disposable app and institution passwords are intentionally `123`; separate hash salts remain cryptographically random.

All identities are fictional; mail.finpilot.test email addresses are reserved test values. Ten distinct application logins; three distinct institution logins per person. Seed is a development starter; application authentication and local SMTP are implemented separately; institution OTP/browser linking still requires integration. Institutions start unlinked, so dashboard/agents should see no account history until consented linking. Data is held in the simulator database and becomes accessible through scoped connection selection.

Thirty months of historical expenses/income include synthetic categories, subscriptions/price changes, paired asset transfers and credit-card payments. Opening balances plus transactions reconcile to stored current balances. Monthly liability interest entries are simplified synthetic ledger events; not real bank statements or tax records. Investment valuations are snapshots, not market feeds.

Demo credentials live only in data/demo-credentials.json. The seed verifies app/institution passwords through scrypt hashes; it never stores plaintext in SQLite. Use local Mailpit for mail.finpilot.test OTP delivery. Never deploy these public demo credentials for real data. Reset only a disposable local DB via --reset.


## Demo credentials and mail

Use the same generated email at FinPilot and each institution simulator, with password `123`. Generated credentials include matching verification recipients and simulated sender metadata. App mail defaults to `FinPilot Demo <security@finpilot.test>`; provider sender metadata uses names such as `Chase Simulator <verification@chase.finpilot.test>`. Provider metadata does not itself implement institution OTP.

Mailpit accepts both legacy `example.test` and new `mail.finpilot.test` recipients only on the explicitly local SMTP hosts. The new seed validator expects the new domain. External SMTP still requires explicitly configured owned recipients.

Existing `.env.local` and databases are preserved by setup. Updating source does not change existing logins. Review your local SMTP_FROM if you want the new display name. Use the documented disposable database reset procedure only when ready to replace local demo data, then rerun migrations; never reset a shared database without coordination.

History remains 30 months per user in this change. Mixed 12-24-month histories and full institution OTP remain outstanding requirements.
