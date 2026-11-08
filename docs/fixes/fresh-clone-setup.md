# Reproducible setup for a fresh clone

## Cause

The application changes were already on main, but local private state was not reproducible from the documented setup. The old setup created only the original 41-account, unlinked seed; the 71-account presentation upgrade had to be run manually. Generated configuration also used `localhost` while the dev/start scripts bind `127.0.0.1`, which can cause the exact-origin CSRF check to reject login. Finally, setup assumed a `python3` executable and did not load `.env` with Next.js precedence.

## Fix

- Fresh demo setup seeds only an absent database, migrates it, and automatically prepares and validates all ten dashboards: seven account types each, 71 accounts, 13,322 transactions.
- Existing databases are migrated without reseeding, expanding or regranting revoked access. `npm run demo:prepare` is the explicit, backed-up upgrade path for older demo clones. It requires `DEMO_MODE=true` and uses the actual configured `DATABASE_PATH`.
- Configuration is loaded with Next.js environment precedence. Existing OTP/provider configuration and environment files are preserved; new local defaults use `http://127.0.0.1:3000`, matching both server scripts. The server fallback and `.env.example` use the same origin. No Origin/CSRF check is relaxed.
- Python 3.11+ is discovered across Windows/macOS/Linux; `PYTHON` may explicitly select an executable. Setup fails clearly if prerequisites or the private OTP secret are missing.
- `validate_presentation.py` verifies populated demo scope, history, ownership foreign keys and reconciled balances read-only. Raw seed tests/validator retain their original unlinked behavior.
- README and SETUP provide a complete clone/install/setup/Mailpit/start sequence and explain how to upgrade older clones and use container database volumes.

## Required runtime configuration

Mailpit must be running for emailed codes: `docker compose up -d mailpit`. Native app users open `http://127.0.0.1:3000/login`; the inbox is `http://localhost:8025`. Use the exact `APP_URL` when customized. Login and institution verification still require real backend verification. NVIDIA credentials/model access remain private server configuration; they are not distributed through Git or invented by setup.

Generated environment files, credentials, SQLite databases, backups and mailbox contents remain excluded from Git. The original active demo database and configuration are not used for clean-clone tests.

## Regression coverage

`tests/backend/setup.test.ts` creates isolated clean project directories and executes the real setup script. It checks fresh preparation, all ten seven-type scopes, repeated-run preservation including revoked connections, `.env` provider/OTP preservation, a custom path containing spaces and explicit-only upgrade of an older raw database.
