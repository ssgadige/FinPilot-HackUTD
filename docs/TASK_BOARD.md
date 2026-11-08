# Implementation tasks

[Project board](https://github.com/users/ssgadige/projects/1) · [All issues](https://github.com/ssgadige/FinPilot-HackUTD/issues) · [Contribution workflow](../CONTRIBUTING.md)

| Task | Workstream | Hours | Issue | Specification |
|---|---|---:|---|---|
| [FP-01] App scaffold and shared UI | A | 1 | [#1](https://github.com/ssgadige/FinPilot-HackUTD/issues/1) | [README](tasks/FP-01/README.md) |
| [FP-02] Login and email verification screens | A | 1.5 | [#2](https://github.com/ssgadige/FinPilot-HackUTD/issues/2) | [README](tasks/FP-02/README.md) |
| [FP-03] Institution catalog and simulated linking | A | 2 | [#3](https://github.com/ssgadige/FinPilot-HackUTD/issues/3) | [README](tasks/FP-03/README.md) |
| [FP-04] Overview transactions and cash calendar | A | 1.5 | [#4](https://github.com/ssgadige/FinPilot-HackUTD/issues/4) | [README](tasks/FP-04/README.md) |
| [FP-05] Subscription manager and offer comparison | A | 1.5 | [#5](https://github.com/ssgadige/FinPilot-HackUTD/issues/5) | [README](tasks/FP-05/README.md) |
| [FP-06] Debt goals assets and scenario UI | A | 1.5 | [#6](https://github.com/ssgadige/FinPilot-HackUTD/issues/6) | [README](tasks/FP-06/README.md) |
| [FP-07] Agent workspace and basic chatbot | A | 1.5 | [#7](https://github.com/ssgadige/FinPilot-HackUTD/issues/7) | [README](tasks/FP-07/README.md) |
| [FP-08] Frontend integration accessibility and demo polish | A | 3.5 | [#8](https://github.com/ssgadige/FinPilot-HackUTD/issues/8) | [README](tasks/FP-08/README.md) |
| [FP-09] Database adapter and validated seed | B | 1 | [#9](https://github.com/ssgadige/FinPilot-HackUTD/issues/9) | [README](tasks/FP-09/README.md) |
| [FP-10] Password email challenge and sessions | B | 2 | [#10](https://github.com/ssgadige/FinPilot-HackUTD/issues/10) | [README](tasks/FP-10/README.md) |
| [FP-11] Simulated institution connection backend | B | 2 | [#11](https://github.com/ssgadige/FinPilot-HackUTD/issues/11) | [README](tasks/FP-11/README.md) |
| [FP-12] Scoped finance read APIs and aggregates | B | 1.5 | [#12](https://github.com/ssgadige/FinPilot-HackUTD/issues/12) | [README](tasks/FP-12/README.md) |
| [FP-13] Calculation tool library | B | 1 | [#13](https://github.com/ssgadige/FinPilot-HackUTD/issues/13) | [README](tasks/FP-13/README.md) |
| [FP-14] Goals subscriptions plans and versioning APIs | B | 1.5 | [#14](https://github.com/ssgadige/FinPilot-HackUTD/issues/14) | [README](tasks/FP-14/README.md) |
| [FP-15] Agent run events chat routes and change trigger | B | 1.5 | [#15](https://github.com/ssgadige/FinPilot-HackUTD/issues/15) | [README](tasks/FP-15/README.md) |
| [FP-16] Backend security and integration verification | B | 3.5 | [#16](https://github.com/ssgadige/FinPilot-HackUTD/issues/16) | [README](tasks/FP-16/README.md) |
| [FP-17] Nemotron adapter and actual tool-call smoke test | C | 1 | [#17](https://github.com/ssgadige/FinPilot-HackUTD/issues/17) | [README](tasks/FP-17/README.md) |
| [FP-18] Bounded agent runtime integrity and cash agents | C | 2 | [#18](https://github.com/ssgadige/FinPilot-HackUTD/issues/18) | [README](tasks/FP-18/README.md) |
| [FP-19] Subscription and deal scout agents with source adapter | C | 1.5 | [#19](https://github.com/ssgadige/FinPilot-HackUTD/issues/19) | [README](tasks/FP-19/README.md) |
| [FP-20] Debt readiness and goal negotiation agents | C | 2 | [#20](https://github.com/ssgadige/FinPilot-HackUTD/issues/20) | [README](tasks/FP-20/README.md) |
| [FP-21] Stress-test specialist and comparisons | C | 1.5 | [#21](https://github.com/ssgadige/FinPilot-HackUTD/issues/21) | [README](tasks/FP-21/README.md) |
| [FP-22] Event-driven plan repair specialist | C | 1.5 | [#22](https://github.com/ssgadige/FinPilot-HackUTD/issues/22) | [README](tasks/FP-22/README.md) |
| [FP-23] Coordinator evidence gate and basic chat role | C | 1 | [#23](https://github.com/ssgadige/FinPilot-HackUTD/issues/23) | [README](tasks/FP-23/README.md) |
| [FP-24] Agent integration sponsor evidence and rehearsal | C | 3.5 | [#24](https://github.com/ssgadige/FinPilot-HackUTD/issues/24) | [README](tasks/FP-24/README.md) |

Each workstream totals 14 planned hours, including integration and verification. Actual contributors are assigned through GitHub Issues. Workflow: Todo → In Progress → Review → Done; record blockers in the issue.

## Conversational coach extension — planned

See [the implementation plan](CHATBOT_PLAN.md) for the uploaded frontend mapping, delivery gates, security boundaries and estimates. These extend FP-07/08 and reuse FP-15/23; they are not part of the original 14-hour lane totals above. Task IDs are local specifications; GitHub issues have not been created.

| Task | Deliverable | Estimate | Dependencies |
|---|---|---:|---|
| [FP-25](tasks/FP-25/README.md) | Chatbot design mapping and contract handoff | 1–2 h | FP-07, FP-15, FP-23 implementation inventory |
| [FP-26](tasks/FP-26/README.md) | Responsive chatbot interface and authenticated API client | 3–4 h | FP-25 |
| [FP-27](tasks/FP-27/README.md) | Agent workspace with chat run cards and evidence navigation | 3–5 h | FP-26; existing FP-15 run/evidence APIs |
| [FP-28](tasks/FP-28/README.md) | Private bounded conversation memory and conversation APIs | 4–6 h | FP-25, FP-26 |
| [FP-29](tasks/FP-29/README.md) | Conversational coaching dialogue and preference discovery | 4–6 h | FP-28 |
| [FP-30](tasks/FP-30/README.md) | Application planning account mappings and monthly semantics | 4–6 h | FP-25; existing FP-14/20/21 tools |
| [FP-31](tasks/FP-31/README.md) | Grounded coach tools for scenarios and agent workflow handoffs | 4–6 h | FP-27, FP-29, FP-30 |
| [FP-32](tasks/FP-32/README.md) | Reviewable coach action cards and confirmed execution | 4–6 h | FP-26, FP-30, FP-31 |
| [FP-33](tasks/FP-33/README.md) | User-requested check-ins and coaching progress | 3–5 h | FP-29, FP-32 |
| [FP-34](tasks/FP-34/README.md) | Coaching preferences and privacy controls UI | 2–4 h | FP-28, FP-33 |
| [FP-35](tasks/FP-35/README.md) | Coach security and conversational quality evaluation | 4–6 h | FP-28–34 |
| [FP-36](tasks/FP-36/README.md) | End-to-end coach journey and design acceptance | 4–6 h | FP-27, FP-32, FP-34, FP-35 |

## Two-hour coach MVP

| Task | Scope | Status | Specification |
|---|---|---|---|
| CHAT-01 | Authenticated chat API client | Implemented; local verification | [README](tasks/CHAT-01/README.md) |
| CHAT-02 | Responsive coach interface | Implemented; local verification | [README](tasks/CHAT-02/README.md) |
| CHAT-03 | Evidence navigation and grounding UI | Implemented; local verification | [README](tasks/CHAT-03/README.md) |
| CHAT-04 | Checkup requests and live run status UI | Implemented; local verification | [README](tasks/CHAT-04/README.md) |
| CHAT-05 | Bounded session conversational context | Implemented; local verification | [README](tasks/CHAT-05/README.md) |
| CHAT-06 | Final combined integration/polish | Complete local acceptance; live verification pending | [README](tasks/CHAT-06/README.md) |

Verification of CHAT-01/02 does not mark the entire FP-07 workspace or FP-25–36 roadmap complete.
