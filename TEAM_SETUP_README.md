# FinPilot — teammate installation README

Use **Visual Studio Code (VS Code)** for this project. The full Visual Studio IDE is not required.

This is the setup checklist for our three-person, 14-hour hackathon build. Install the desktop tools now; account logins, API keys and deployment configuration can be completed together later. The repository currently contains the implementation plan, contracts, prompts and working data generator. The web app and Docker application image are still to be built.

## 1. Our agreed stack

| Part | Tool | What it does | Separate download? |
|---|---|---|---|
| Editor | VS Code + Codex extension | Write and review code | Yes |
| Source control | Git + GitHub | Shared repository, branches and PRs | Git yes; GitHub in browser |
| Frontend | React + Next.js + TypeScript | Dashboard, forms, charts and chatbot interface | Installed through project npm dependencies |
| Backend | Next.js server routes on Node.js | Login, account APIs, finance tools and agent execution | Node.js yes; backend packages through npm |
| Database | SQLite | Stores users, connected demo accounts, history, plans and agent runs | Embedded in app; no database server to install |
| Database viewer | DB Browser for SQLite | Inspect tables and run development queries | Recommended for everyone; especially backend owner |
| Agents and chatbot | NVIDIA Nemotron hosted API | All specialist agents, coordinator and basic chat | API account/key later; no local model download |
| Containers | Docker Desktop + Docker Compose | Run our app and local email service consistently | Yes on Windows/macOS; Linux Engine + Compose is an alternative |
| Email testing | Mailpit container | Receives test login-verification emails | Downloaded as a Docker image later |
| Demo data | Python 3.11+ | Generates and validates 30 months of synthetic records | Yes for running the supplied scripts locally |

One Next.js application handles the frontend and backend. One SQLite database handles the project data. Docker runs the application; Nemotron inference stays on the hosted NVIDIA service. No GPU/CUDA setup is needed for this chosen approach. Database files must be kept in persistent Docker storage.

## 2. Install these on each teammate's laptop

Install in this order. Keep existing compatible installations.

| Install | Official download | Check in terminal |
|---|---|---|
| Git | https://git-scm.com/downloads | `git --version` |
| VS Code | https://code.visualstudio.com/download | Open VS Code; `code --version` if command is on PATH |
| Node.js 22.x, version 22.13 or newer | https://nodejs.org/en/download | `node --version` and `npm --version` |
| Python 3.11 or newer | https://www.python.org/downloads/ | Windows: `py --version`; macOS/Linux: `python3 --version` |
| Docker Desktop | https://www.docker.com/products/docker-desktop/ | `docker --version`, `docker compose version`, `docker info` |
| DB Browser for SQLite | https://sqlitebrowser.org/dl/ | Open the application |

Use the same Node major version across the team. Node 22 is our project baseline; choose the latest available 22.x patch. Reopen VS Code after installing tools so its terminal sees PATH updates. npm comes with Node.js. Docker Desktop includes Compose; no separate Compose download is needed on Desktop installations.

### Windows Docker setup

1. Check the current [Docker Windows requirements](https://docs.docker.com/desktop/setup/install/windows-install/) for your Windows edition/version.
2. Use the WSL 2 backend and Linux containers for this application.
3. Check WSL with `wsl --version` and `wsl --status` in PowerShell.
4. If WSL is missing, follow the [Microsoft WSL installation guide](https://learn.microsoft.com/en-us/windows/wsl/install); run `wsl --install` from an administrator PowerShell when required, then restart if prompted. Use `wsl --update` if an installed WSL needs updating.
5. Start Docker Desktop and wait for its engine to run. Enable firmware virtualization if Docker reports it is disabled.
6. Run `docker info` and `docker compose version`. An installed CLI alone does not mean the engine is running.

For macOS, choose the Docker build matching Apple Silicon or Intel. For Linux, use Docker Desktop or Docker Engine with the Compose plugin from [Docker's official installation documentation](https://docs.docker.com/engine/install/).

### VS Code extensions

Install the official Codex extension, ESLint and Prettier. Docker/container tools and GitHub Pull Requests are optional conveniences. If working inside WSL, install Microsoft's WSL extension too. Sign in to Codex/GitHub later when we configure accounts. Do not share personal login credentials.

## 3. Clone and open the repository

After your GitHub account is invited to the private repository:

```bash
git clone https://github.com/ssgadige/FinPilot-HackUTD.git
cd FinPilot-HackUTD
code .
```

If `code` is unavailable, open VS Code → File → Open Folder and select this folder. If cloning says Repository not found, check the signed-in GitHub account and repository access first.

Before coding, create your task branch, for example:

```bash
git switch -c feat/FP-01-app-shell
```

Choose your actual task from [the task board](docs/TASK_BOARD.md). A owns frontend, B owns backend/security/data, C owns Nemotron agents. Each task has its own README.

## 4. Run the data starter now

Windows PowerShell:

```powershell
py scripts/seed_demo.py
py scripts/validate_seed.py
py -m unittest discover -s tests -v
```

macOS/Linux:

```bash
python3 scripts/seed_demo.py
python3 scripts/validate_seed.py
python3 -m unittest discover -s tests -v
```

Expected: 10 fictional users, 30 simulated institution logins, 41 accounts, 12,062 transactions and 30 months per user. The test suite currently has five checks.

Generated files:

- `data/finpilot-demo.sqlite`: open with DB Browser → Open Database.
- `data/demo-credentials.json`: fictional application and institution passwords for local testing.
- `data/seed-manifest.json`: record counts and seed metadata.

These are gitignored. Do not commit them. Re-running the seed refuses to overwrite existing data; `--reset` is only for intentionally replacing your disposable local demo data. Each reset generates new demo passwords. Every laptop gets its own independent database and credentials. Avoid editing the SQLite file manually while the app is writing to it; use app APIs for normal development.

## 5. Frontend/backend packages — installed once through the repository

The application owner will create `package.json` and commit `package-lock.json` in FP-01. Teammates then use `npm ci` to install the same package versions. Do not each scaffold a separate app or run unrelated npm installs.

| Package group | Planned packages |
|---|---|
| UI and server framework | `next`, `react`, `react-dom`, `typescript` |
| Database access and validation | `better-sqlite3`, `zod` |
| Email | `nodemailer` |
| Charts/icons | `recharts`, `lucide-react` |
| Development/testing | ESLint, Prettier, Vitest, Playwright and matching TypeScript definitions |

Nemotron can be called through server-side HTTP using Node's fetch; a separate Python AI framework is not required. Password hashing uses Node crypto scrypt to match the supplied seed format. Native SQLite packages must be installed/built for Linux inside Docker; never copy Windows/macOS `node_modules` into the image.

After FP-01 creates the application and scripts, the local development workflow will be:

```bash
npm ci
npm run dev
```

The planned app URL is http://localhost:3000 . These commands cannot start the app yet because the application scaffold has not been implemented.

## 6. Docker runtime plan

The team will add `Dockerfile`, `compose.yaml` and `.dockerignore` as part of the backend/integration work. This README does not claim those runtime files already exist.

| Component | Container/service | Storage/network requirement |
|---|---|---|
| Frontend + backend + agents | `app` | Next.js Node server; localhost port 3000 for local demo |
| SQLite | File used by `app`, no separate service | Named volume mounted at `/app/data`; `DATABASE_PATH=/app/data/finpilot-demo.sqlite` |
| Login email inbox | `mailpit` | App SMTP host `mailpit`, port `1025`; host web inbox bound to `127.0.0.1:8025` |
| Nemotron | External hosted API | Outbound HTTPS from app; key only in server environment |

Inside Docker, `localhost` means the current container. Therefore the app must use `SMTP_HOST=mailpit`, not `127.0.0.1`. Browser access remains http://localhost:8025 for the local inbox. Mailpit is shared development mail, not real inbox delivery; keep its UI local and synthetic-only.

Implementation requirements: pinned compatible images/dependencies; seed the persistent volume explicitly once without an automatic destructive reset; non-root app process with correct volume ownership; health checks; graceful SQLite close; server-only runtime secrets; `.dockerignore` excludes env, DB, credentials, node_modules and git. Rebuilding an image must preserve users/history. A container must not reset the database on every restart. Keep a single app instance for this SQLite prototype.

Once the Compose/app files are implemented and documented, the intended workflow is:

```bash
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 app
docker compose down
```

`docker compose down` stops the stack while preserving named volumes by default. Do not use `down -v` unless deliberately discarding the demo database. The container seed command will be documented by B after the runtime exists; the current host-generated database is not automatically copied into a named volume.

Docker packages the runtime; public hosting still needs a Docker-capable machine and HTTPS. For the hackathon, run Compose on the demo laptop first. Public server/account configuration comes later.

## 7. Accounts and environment settings — later

- GitHub: each teammate uses their own account; verify repository access.
- NVIDIA: agent owner obtains an API key and accessible Nemotron model supporting our tool-call workflow. Confirm quota with a real smoke test. Do not put keys in chat, source code or frontend environment variables.
- Email: Mailpit needs no real email account. The fictional `example.test` logins use this local SMTP inbox. Real email delivery later needs a verified sender and SMTP credentials.
- Jira: browser account and Atlassian connection later; no desktop installation.

Copy `.env.example` to a local ignored environment file. Store `NVIDIA_API_KEY`, model ID, session secret and OTP secret server-side. For the future Compose runtime, explicitly map its environment file/variables in Compose; `.env.local` is not automatically injected into a container. Never bake it into the image. All demo bank login fields accept only generated fictional credentials.

## 8. Ready-to-start checklist

- [ ] VS Code opens the cloned repository.
- [ ] Git, Node/npm and Python version commands work.
- [ ] Docker Desktop engine is running; Compose works.
- [ ] DB Browser opens the seeded SQLite file.
- [ ] Seed validation and five tests pass.
- [ ] Read your task README and shared API contracts.
- [ ] Later: GitHub access, NVIDIA credentials and email configuration verified.
- [ ] After implementation: app starts in Compose and database survives stop/start.

No MySQL Workbench, PostgreSQL server, MongoDB, separate Express backend, CUDA toolkit or local Nemotron weights are part of this agreed setup. SQLite plus Next.js covers the scoped build.

Official references: [Docker Compose](https://docs.docker.com/compose/install/), [Docker Windows setup](https://docs.docker.com/desktop/setup/install/windows-install/), [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [NVIDIA tool calling](https://docs.nvidia.com/nim/large-language-models/1.15.0/function-calling.html).
