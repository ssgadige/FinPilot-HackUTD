# FinPilot — HackUTD

**Your finances connected. Your agents working together. Your next move explained.**

Independent hackathon prototype for the PNC 360° Financial Health Navigator and NVIDIA Nemotron challenges. Not an official PNC product. No code, requirements, or institutional SSO from the Assessment Helper capstone belongs here.

## Repository status

This commit is the **implementation handoff**, not a finished banking application. It contains the product specification, 14-hour / three-person backlog, individual task READMEs, agent contracts and prompts, database schema, runnable synthetic-data generator, validation checks, and setup instructions. The application, authentication endpoints, Nemotron runtime, and UI are tasks to implement. Nothing in this repository claims those features already work.

## Start here

1. Read [Team start](docs/TEAM_START.md).
2. Follow [Downloads and setup](docs/SETUP.md). Logins and provider configuration can happen later.
3. Read [Product and UI](docs/PRODUCT.md), [Architecture](docs/ARCHITECTURE.md), and [14-hour plan](docs/BUILD_PLAN.md).
4. Pick a work lane from [Task board](docs/TASK_BOARD.md). Each task has its own README.
5. Review [API contracts](docs/API.md), [Agent design](docs/AGENTS.md), and [Security](docs/SECURITY.md) before implementation.

## Product

One overview for bank accounts, cards, loans, savings, investment snapshots, subscriptions, bills, and goals. Eight specialist agents collaborate through a coordinator; a basic Nemotron chat interface explains findings and requests new runs. A subscription saving becomes a proposed goal allocation, survives a stress test, and gets revised when new spending arrives.

## Build boundary

- Ten fictional people; 30 months of distinct history; separate application and simulated-institution credentials.
- Banks and credit unions → PNC, Bank of America, Chase, Capital One, Ally; cards → Amex and Discover; investments → Fidelity and Vanguard; loans → Demo Auto Finance and Demo Mortgage; digital wallets → PayPal. All institution labels refer to simulations.
- Account linking is a local simulator with consent, credential validation, account selection, sync, and disconnect. Never enter a real bank password.
- Local SQLite database for one demo server. Cloud/serverless hosting needs persistent database storage; do not assume an ephemeral filesystem is durable.
- Real Nemotron inference and SMTP email are integration targets. Without configuration show explicit unavailable states, not fake successful calls.
- Deals use an allowlisted public offer adapter plus clearly labeled fixture fallback. Prices and eligibility must be verified before claiming live savings.
- No real transfers, bill payments, cancellations, investment trades, lender decisions, credit-score guarantees, or production-security claims.

## Reproducible data starter

Python 3.11+; no third-party packages:

```bash
python scripts/seed_demo.py
python scripts/validate_seed.py
python -m unittest discover -s tests -v
```

Generated database: `data/finpilot-demo.sqlite`. Generated credentials: `data/demo-credentials.json`. Both are local and gitignored. Never seed a production database. Re-running refuses to overwrite unless you explicitly use `--reset`.

## Team lanes

| Lane | Focus | Planned effort |
|---|---|---|
| A | UI, dashboard, institution linking screens, subscriptions, goals, chat | 14 hours |
| B | Database, authentication, simulator, finance tools, API, security | 14 hours |
| C | Nemotron, specialist agents, orchestration, offer integration, demo | 14 hours |

These are placeholders, not assigned GitHub identities. Map names later. Board statuses: Backlog → Ready → In progress → Review → Done; add Blocked when necessary. A task is Done only when its acceptance checks pass.

## Repository map

- `docs/tasks/*/README.md`: 24 implementation tickets, ready for Jira/GitHub.
- `docs/jira-import.csv`: import-ready task descriptions; map fields in Jira before import.
- `contracts/`: shared TypeScript types and JSON result schema.
- `src/server/agents/`: eight specialist prompts, coordinator and chat prompts.
- `scripts/`: seed generation, data checks, ticket export.
- `data/schema.sql`: application and simulated-bank schema.
- `.github/`: issue/PR templates and seed validation workflow.

See [Demo script](docs/DEMO.md) and [sources](docs/SOURCES.md). Repo creation and planning do not imply any external service is configured.
