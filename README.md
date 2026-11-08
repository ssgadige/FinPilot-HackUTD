# FinPilot

A financial health navigator built for HackUTD. FinPilot brings accounts, debts, subscriptions and goals into one dashboard, with NVIDIA Nemotron agents that detect conflicts, compare options and propose changes to a financial plan.

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

Product specifications, issue backlog, contracts, agent prompts, SQL schema and synthetic-data scripts are available. The web application, authentication routes, agent runtime and Docker application files are pending implementation.

Run the data checks with Python 3.11 or newer:

```bash
python scripts/seed_demo.py
python scripts/validate_seed.py
python -m unittest discover -s tests -v
```

The dataset contains 10 fictional profiles and 30 months of history. Generated credentials and database files are excluded from version control.

FinPilot is an independent hackathon prototype. Institution connections and financial records are simulated. It is not affiliated with PNC or any listed institution and does not execute real financial transactions.
