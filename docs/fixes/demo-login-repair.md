# Existing demo login credential repair

Current seed source uses the documented fictional emails and password, but `npm run setup` preserves existing databases and does not rotate their original random seed passwords. A Docker volume can therefore remain on older credentials after a code update. This is a likely cause of invalid-login errors, not a diagnosis of any remotely running database.

## Inspect the actual running database

Identify the app instance and its effective DATABASE_PATH first. Docker Compose currently overrides the host setting to `/app/data/finpilot-demo.sqlite`; modifying the host's `data/` file does not modify that named volume. For a local Node process, inspect its startup environment/.env.local instead. Never print secrets, hashes or credential files.

Run on the machine/container that owns the active database:

```sh
python3 scripts/repair_demo_logins.py --database ACTUAL_PATH
```

Inspection is read-only and reports how many recognized demo users/institution credentials need repair. If it reports zero, do not assume this fixes the incident: investigate the actual request URL/response, instance mismatch, wrong institution or email, whitespace, older running image, proxy origin and rate limits.

## Apply to the recognized fixture database

```sh
python3 scripts/repair_demo_logins.py --database ACTUAL_PATH --apply
```

Use `py -3` on Windows if that is the installed Python command. The script:
- Requires an existing database labeled source_mode=fixture and all ten recognized synthetic IDs/names/emails.
- Refuses unknown identities/usernames and destination email conflicts.
- Creates a consistent SQLite backup before any credential mutation.
- Updates the ten known app identities and their actual institution logins to the documented matching email/password convention, using separate salted scrypt hashes.
- Revokes sessions, pending login challenges and linking previews only for changed users. These users must sign in again.
- Does not modify financial records, connected-account selections, goals, plans, environment configuration, OTP secrets or auth verification logic.
- Does not add providers from the expanded draft dataset.
- Does not clear global rate limits or grant a verified session.
- Is a no-op if credentials already match.

For Docker without this script in the running image, copy only the repair script and its existing `scripts/seed_demo.py` hashing dependency into a private temporary directory in the app container. Execute there against its effective DATABASE_PATH. Do not rebuild or switch the active frontend branch just to run the repair. Keep both script files together for the import. Never use `--reset` or `docker compose down -v`.

Generated `demo-credentials.json` exports are not rewritten; older exports can remain stale. The repaired database is authoritative. Do not post exports or hashes in chat. Backups remain private and must not be committed.

## Verify the application after repair

1. Start a fresh login with `maya.chen@mail.finpilot.test`, password `123`.
2. Expect a real 202 challenge and delivery to the Mailpit configured for that app. Complete its fresh code in the same browser.
3. Confirm session creation occurs only after verification and financial access remains denied before it.
4. Verify all ten app password hashes locally without triggering a burst of email challenges; test another persona through the actual app.
5. For institution sign-in, use only a provider that belongs to that user in the installed database. Expanded PR #45 providers do not exist automatically on main. Institution OTP may remain separately blocked.
6. Confirm accounts, transaction totals and saved connections are unchanged; logout and re-login still work.

Six tests pass for read-only inspection, financial/connection preservation, consistent pre-change backup, valid independent credential hashes, idempotency, unknown/non-fixture identity refusal and nonexistent-path refusal. These tests do not prove that a user's remote database has been repaired. Run the application/Mailpit verification above before claiming that.
