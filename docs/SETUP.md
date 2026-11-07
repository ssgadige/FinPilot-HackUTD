# Downloads and setup checklist

Start with [Teammate installation README](../TEAM_SETUP_README.md). Docker Compose is now the agreed runtime target; provider logins remain deferred.

Do the repository work first. Provider logins and paid services are deferred; no purchase is required by this plan.

## Required on all three computers

| Tool | Install/source | Verification | Purpose |
|---|---|---|---|
| Git | https://git-scm.com/downloads | `git --version` | Branches and PRs |
| VS Code | https://code.visualstudio.com/download | Open repository folder | Editor |
| Node.js 22 LTS, at least 22.13 | https://nodejs.org/en/download | `node --version`, `npm --version` | Planned Next.js runtime |
| Docker Desktop + Compose | https://www.docker.com/products/docker-desktop/ | `docker info`, `docker compose version` | Shared container runtime |
| Python 3.11+ | https://www.python.org/downloads/ | Windows: `py --version`; macOS/Linux: `python3 --version` | Dependency-free seed tools |
| Chrome/Edge/Firefox | Official vendor | Open localhost after app implementation | UI testing |

VS Code extensions: official Codex extension (if not already present), ESLint, Prettier; GitHub Pull Requests optional. Install from official marketplace. Docker is required for our agreed application runtime. A GPU driver, CUDA toolkit, local Nemotron download, or Jira desktop app is not required for hosted inference.

## Backend developer: local email inbox

Use Mailpit from https://mailpit.axllent.org/docs/install/ . Run Mailpit as a Compose service when the runtime files are implemented. A standalone binary is optional for early development. Local SMTP defaults to port 1025 and web inbox to http://localhost:8025; bind the inbox to localhost. Inside Compose use SMTP_HOST=mailpit rather than localhost. This captures messages for fictional `example.test` addresses. It does not deliver email to real mailboxes and is not production 2FA.

Optional DB Browser for SQLite: https://sqlitebrowser.org/dl/ . Optional GitHub CLI: https://cli.github.com/ . Neither is needed to run the supplied scripts.

## First local setup (works now)

```bash
git clone https://github.com/ssgadige/FinPilot-HackUTD.git
cd FinPilot-HackUTD
python scripts/seed_demo.py
python scripts/validate_seed.py
python -m unittest discover -s tests -v
```

Replace `python` with `py` or `python3` as appropriate. Copy `.env.example` to `.env.local` using the file explorer or your shell. Never commit it. Generate each server secret independently with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and put the result in its field. Generated demo credentials are for this simulation only.

## Application dependencies (FP-01 / FP-09; not installed by this handoff)

Use one Next.js App Router + TypeScript application for UI and server routes; choose stable compatible versions and commit package-lock.json. Node 22.13+ is the common team baseline. Initialize into this existing repository carefully; do not overwrite the docs/schema. If create-next-app refuses a nonempty directory, generate in a temporary directory and copy only application/config files.

Planned runtime packages: `next`, `react`, `react-dom`, `better-sqlite3`, `zod`, `nodemailer`, `recharts`, `lucide-react`. Planned development packages: `typescript`, `eslint`, `eslint-config-next`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/better-sqlite3`, `@types/nodemailer`, `vitest`, `@playwright/test`. Use Node crypto scrypt to verify seed password hashes. Use server-only modules for DB, SMTP, sessions and inference. No Prisma requirement; the canonical schema is SQL to reduce tooling in 14 hours.

Once FP-01 supplies package.json: `npm ci`, `npm run dev`, `npm run lint`, `npm run build`, `npm test`. Do not run these before the application task creates the scripts. Native SQLite dependencies may need platform build tools if a prebuilt binary is unavailable; resolve immediately on B's machine, or use Node's supported SQLite interface after documenting the change.

## Provider accounts and settings — later

| Service | What to prepare | Owner | Gate |
|---|---|---|---|
| GitHub | Repo access; verified teammate usernames | All | Ready repository; invitations pending |
| Jira / Atlassian | Existing site and project or new team project; connect Atlassian | Team lead | Import CSV after site/project selection |
| NVIDIA hosted API | API key, accessible Nemotron model ID, quota | C | Real tool-call smoke test; never infer model availability from its name |
| Email provider | SMTP credentials and verified sender; test recipient consent | B | Needed only for real delivery; Mailpit for local fictional accounts |
| Hosting | Docker Compose app + persistent SQLite volume + Mailpit; HTTPS for public access | B | Required runtime target; local Compose demo first, public hosting optional |
| Deal sources | Explicit allowlisted public provider URLs | C | No login or subscription purchase; verified offer metadata |

Neither Bank of America, Chase, nor any other real institution needs a login. The simulated linking experience uses the seed credentials. Never collect a teammate's real banking details.

## Tool readiness checklist

- [ ] All machines clone repo and use same Node major.
- [ ] Seed validation passes; local credential file exists.
- [ ] Lockfile created and `npm ci` works for everyone.
- [ ] NVIDIA tool round trip works and model ID recorded.
- [ ] Mailpit receives an OTP message; wrong/expired/replayed OTPs fail.
- [ ] External provider secrets stored only on the server.
- [ ] Jira connection and team identities confirmed later.
- [ ] Build and isolated user tests pass before demo.

If NVIDIA credentials are missing, the app must say AI unavailable. If SMTP is unavailable, login must fail with a useful error; do not silently bypass verification. If the offer endpoint fails, return source_mode=fixture and an explicit sample-data badge.
