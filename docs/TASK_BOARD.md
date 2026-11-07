# Implementation task board

Jira setup is deferred. This file and jira-import.csv are the source backlog until connected. Lane assignments are placeholders; do not assume actual team identities. All implementation tasks start Backlog.

| Task | Owner | Hours | Dependencies | Task README |
|---|---|---:|---|---|
| FP-01 — App scaffold and shared UI | A | 1 | None | [README](tasks/FP-01/README.md) |
| FP-02 — Login and email verification screens | A | 1.5 | FP-01; FP-10 API contract | [README](tasks/FP-02/README.md) |
| FP-03 — Institution catalog and simulated linking | A | 2 | FP-01; FP-11 API | [README](tasks/FP-03/README.md) |
| FP-04 — Overview transactions and cash calendar | A | 1.5 | FP-01; FP-12 API | [README](tasks/FP-04/README.md) |
| FP-05 — Subscription manager and offer comparison | A | 1.5 | FP-01; FP-13; FP-19 | [README](tasks/FP-05/README.md) |
| FP-06 — Debt goals assets and scenario UI | A | 1.5 | FP-01; FP-13/14/20/21 | [README](tasks/FP-06/README.md) |
| FP-07 — Agent workspace and basic chatbot | A | 1.5 | FP-01; FP-15/23 | [README](tasks/FP-07/README.md) |
| FP-08 — Frontend integration accessibility and demo polish | A | 3.5 | FP-02..07; B/C integration | [README](tasks/FP-08/README.md) |
| FP-09 — Database adapter and validated seed | B | 1 | None | [README](tasks/FP-09/README.md) |
| FP-10 — Password email challenge and sessions | B | 2 | FP-09 | [README](tasks/FP-10/README.md) |
| FP-11 — Simulated institution connection backend | B | 2 | FP-09/10 | [README](tasks/FP-11/README.md) |
| FP-12 — Scoped finance read APIs and aggregates | B | 1.5 | FP-09/10/11 | [README](tasks/FP-12/README.md) |
| FP-13 — Calculation tool library | B | 1 | FP-09; contracts/types.ts | [README](tasks/FP-13/README.md) |
| FP-14 — Goals subscriptions plans and versioning APIs | B | 1.5 | FP-09/10/13 | [README](tasks/FP-14/README.md) |
| FP-15 — Agent run events chat routes and change trigger | B | 1.5 | FP-10/12/14; C runtime | [README](tasks/FP-15/README.md) |
| FP-16 — Backend security and integration verification | B | 3.5 | FP-10..15 | [README](tasks/FP-16/README.md) |
| FP-17 — Nemotron adapter and actual tool-call smoke test | C | 1 | NVIDIA key/model available later | [README](tasks/FP-17/README.md) |
| FP-18 — Bounded agent runtime integrity and cash agents | C | 2 | FP-17; FP-13 contract | [README](tasks/FP-18/README.md) |
| FP-19 — Subscription and deal scout agents with source adapter | C | 1.5 | FP-17/18; merchant and offer tools | [README](tasks/FP-19/README.md) |
| FP-20 — Debt readiness and goal negotiation agents | C | 2 | FP-18; FP-13/14 | [README](tasks/FP-20/README.md) |
| FP-21 — Stress-test specialist and comparisons | C | 1.5 | FP-20; FP-13 | [README](tasks/FP-21/README.md) |
| FP-22 — Event-driven plan repair specialist | C | 1.5 | FP-20/21; FP-15 event contract | [README](tasks/FP-22/README.md) |
| FP-23 — Coordinator evidence gate and basic chat role | C | 1 | FP-18..22; FP-15 | [README](tasks/FP-23/README.md) |
| FP-24 — Agent integration sponsor evidence and rehearsal | C | 3.5 | FP-17..23; A/B integration | [README](tasks/FP-24/README.md) |

Lane totals: A=14h; B=14h; C=14h. Total=42 person-hours. Use statuses Backlog, Ready, In progress, Review, Done, Blocked. Reviewer from another lane for shared contracts and security-sensitive changes.
