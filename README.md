# FinPilot

A financial health navigator built for HackUTD. FinPilot brings accounts, debts, subscriptions and goals into one dashboard, with NVIDIA Nemotron agents that detect conflicts, compare options and propose changes to a financial plan.

## Run a fresh clone

Use the Node version in `.nvmrc`, Python 3.11+ and Docker for the local email inbox.

```sh
git clone https://github.com/ssgadige/FinPilot-HackUTD.git
cd FinPilot-HackUTD
npm ci
npm run setup
docker compose up -d mailpit
npm run dev
```

Open **http://127.0.0.1:3000/login** and **http://localhost:8025** for email codes. Fresh demo setup automatically prepares all ten profiles with seven account types, 71 accounts and 13,322 transactions. Use a fictional demo login below; login still requires the emailed code. AI responses require your own server-side NVIDIA configuration.

Already set up an older clone with empty dashboards? Pull main, run `npm ci`, then **`npm run demo:prepare`** and restart the app. This explicitly upgrades the configured demo database after taking a backup. Ordinary repeated `npm run setup` preserves existing connection/disconnect choices and records. See [SETUP.md](SETUP.md) for native/container paths and configuration.

## Judge demo logins

These are **public fictional demo accounts**, provided for judging after running the setup above. The **demo password is `123` for all ten accounts**. No registration or manual institution linking is needed for the prepared dashboards.

| Profile | Login email | Example focus |
|---|---|---|
| Maya Chen | `maya.chen@mail.finpilot.test` | Car purchase planning |
| Jordan Brooks | `jordan.brooks@mail.finpilot.test` | Irregular freelance income |
| Priya Shah | `priya.shah@mail.finpilot.test` | Subscriptions |
| Luis Rivera | `luis.rivera@mail.finpilot.test` | Card utilization |
| Amina Hassan | `amina.hassan@mail.finpilot.test` | Mortgage household |
| Ethan Park | `ethan.park@mail.finpilot.test` | Limited cash buffer |
| Sofia Martinez | `sofia.martinez@mail.finpilot.test` | Savings and CD maturity |
| Noah Williams | `noah.williams@mail.finpilot.test` | Retirement income |
| Zoe Patel | `zoe.patel@mail.finpilot.test` | Home down payment |
| Oliver Reed | `oliver.reed@mail.finpilot.test` | Irregular charges |

1. Open **http://127.0.0.1:3000/login**, enter any email above and the demo password `123`, then select **Continue**.
2. Open **http://localhost:8025**, find the **newest email addressed to that profile**, and copy its six-digit verification code.
3. Enter the code in FinPilot and select **Verify and sign in**. The profile's prepared accounts and financial history appear automatically.
4. Use **Sign out** before trying another profile.

Codes expire after five minutes and are single use; always use the newest email. There is no fixed verification code or authentication bypass. Mailpit must be running (`docker compose up -d mailpit`).

For a hosted presentation, use the **app URL supplied by the team**; the localhost links above work only on the computer running the local demo. The presenting team must also provide access to the verification email/code. If the database's demo passwords were deliberately changed, use its private `data/demo-credentials.json` or ask the presenting team. Only the standard fictional demo logins are published here; server keys, session tokens, OTPs and generated runtime files remain private.

## Development

- [Project board](https://github.com/users/ssgadige/projects/1)
- [Implementation issues](https://github.com/ssgadige/FinPilot-HackUTD/issues)
- [Installation](SETUP.md)
- [Contributing and pull requests](CONTRIBUTING.md)
- [Task index](docs/TASK_BOARD.md)

## Features

- Institution catalog with simulated account linking, consent and account selection.
- Account summaries, transaction history, cash forecasts and financial indicators.
- Subscription detection, sourced offer comparisons and cost-saving proposals.
- Debt scenarios, savings goals and coordinated financial plans.
- Eight specialist agents, a coordinator and a Nemotron chat interface.
- Stress tests and proposed plan revisions when financial data changes.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Next.js server routes, Node.js |
| Database | SQLite |
| AI | NVIDIA Nemotron hosted API |
| Runtime | Docker Compose |
| Development email | Mailpit |

## Documentation

| Document | Contents |
|---|---|
| [Product specification](docs/PRODUCT.md) | Application sections and behavior |
| [UI specification](docs/UI_DESIGN.md) | Visual system and screen requirements |
| [Architecture](docs/ARCHITECTURE.md) | Components, data flow and ownership |
| [API contract](docs/API.md) | Routes, payloads and error behavior |
| [Agent design](docs/AGENTS.md) | Roles, dependencies and tool execution |
| [Security](docs/SECURITY.md) | Authentication, authorization and data handling |
| [Build plan](docs/BUILD_PLAN.md) | Delivery sequence and workstreams |

## Current status

The web application, authentication, simulator account linking, finance backend and bounded agent services are implemented. Authenticated run, polling, cancellation, chat and demo-event APIs are implemented. The coach interface, evidence drawer, checkup activity/cancellation controls and bounded session conversation context are implemented; advanced feature screens and general planning mappings remain incomplete. Tasks 15–16 connect and verify these APIs; Tasks 22–24 add durable repair, coordinator/evidence/chat services and local integration verification; full live/browser rehearsal is not yet accepted. See [verification status](src/server/agents/integration/README.md).

Run the data checks with Python 3.11 or newer:

```bash
python scripts/seed_demo.py
python scripts/validate_seed.py
python -m unittest discover -s tests -v
```

The dataset contains 10 fictional profiles and 30 months of history. Generated credentials and database files are excluded from version control.

FinPilot is an independent hackathon prototype. Institution connections and financial records are simulated. It is not affiliated with PNC or any listed institution and does not execute real financial transactions.

## Preloaded presentation dashboards

`npm run setup` prepares new demo databases automatically. To upgrade an **existing** recognized demo database explicitly:

```sh
npm run demo:prepare
```

The command uses `DATABASE_PATH` with the same environment-file precedence as Next.js, finds a supported Python executable across Windows/macOS/Linux, backs up existing data and adds missing records/access idempotently. It preserves credentials and existing ledger entries. Use the configured database, not a separate host copy of a Docker volume. Normal login, verification, ownership and disconnect protections remain enforced. Databases and secrets are intentionally not pushed to GitHub.

For an inspection-only preview or a non-default path, the original Python command remains available:

```sh
python scripts/prepare_demo_dashboards.py --database ./data/finpilot-demo.sqlite --expand-account-types
python scripts/validate_presentation.py --database ./data/finpilot-demo.sqlite
```

The first command never applies changes. The second verifies a prepared presentation database. See [fresh-clone verification](docs/fixes/fresh-clone-setup.md) and [presentation verification](docs/fixes/demo-presentation-polish.md).
