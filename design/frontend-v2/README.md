# FinPilot product design v2

[Editable Figma design](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ) · [Interactive walkthrough](https://www.figma.com/proto/ZivHogk7C4OSm6uoscYegQ/FinPilot?node-id=11-1076&starting-point-node-id=11-1076) · [Review PR #25](https://github.com/ssgadige/FinPilot-HackUTD/pull/25)

## Coverage

47 desktop/mobile screens, 24 task-specific implementation handoffs, 12 calculator contracts and 11 walkthrough entry points. Native editable layers use shared banking colors, typography, controls and status components. This version supersedes the earlier SVG blueprint set.

The agent workspace leads the experience: dated cash collisions, evidence-backed findings, subscription comparisons, goal negotiation, scenario stress tests and plan repair. Chat is the communication surface. The product also covers institution categories, simulated provider sign-in, explicit consent, accounts, transactions, authentication/2FA, connection recovery, security settings and responsive views.

## Implementation use

Start with the task handoff below. FP-01–FP-08 contain customer-facing screens; FP-09–FP-24 document backend and agent responsibilities and identify the screens they support. They intentionally share customer screens rather than invent separate customer pages for infrastructure work.

Prototype buttons navigate preset states. Text entry, financial calculations, authentication, live bank connections and Nemotron inference require application implementation. Simulated records and sample offers are labeled. No real bank credentials belong in this prototype.

| Task | Scope | Figma handoff |
|---|---|---|
| FP-01 | App scaffold and shared UI | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-46) |
| FP-02 | Login and email verification screens | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-163) |
| FP-03 | Institution catalog and simulated linking | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-310) |
| FP-04 | Overview transactions and cash calendar | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-479) |
| FP-05 | Subscription manager and offer comparison | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-652) |
| FP-06 | Debt goals assets and scenario UI | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1038) |
| FP-07 | Agent workspace and basic chatbot | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1175) |
| FP-08 | Frontend integration accessibility and demo polish | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1270) |
| FP-09 | Database adapter and validated seed | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1330) |
| FP-10 | Password email challenge and sessions | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1382) |
| FP-11 | Simulated institution connection backend | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1439) |
| FP-12 | Scoped finance read APIs and aggregates | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1496) |
| FP-13 | Calculation tool library | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1551) |
| FP-14 | Goals subscriptions plans and versioning APIs | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1606) |
| FP-15 | Agent run events chat routes and change trigger | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1660) |
| FP-16 | Backend security and integration verification | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1717) |
| FP-17 | Nemotron adapter and actual tool-call smoke test | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1774) |
| FP-18 | Bounded agent runtime integrity and cash agents | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1826) |
| FP-19 | Subscription and deal scout agents with source adapter | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1881) |
| FP-20 | Debt readiness and goal negotiation agents | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1938) |
| FP-21 | Stress-test specialist and comparisons | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-1991) |
| FP-22 | Event-driven plan repair specialist | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-2043) |
| FP-23 | Coordinator evidence gate and basic chat role | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-2094) |
| FP-24 | Agent integration sponsor evidence and rehearsal | [Open](https://www.figma.com/design/ZivHogk7C4OSm6uoscYegQ?node-id=4-2150) |

## Calculators

See [CALCULATORS.md](CALCULATORS.md) for formulas, inputs, rounding, validation and examples. The reference implementation passes 41 checks; it is a mathematical handoff, not a production banking engine. Product code must independently validate inputs, authorization and API results.

```bash
python -m unittest discover -s design/frontend-v2/reference -v
```

## Files

- `task-map.json`: task names, handoff links and supported screen references.
- `screens.json`: content and intended primary actions.
- `figma-map.json`: native node IDs and prototype entry point.
- `reference/`: decimal-based calculator examples and tests.

Work on feature branches, reference the issue, request review and merge after checks. The design update remains on the design branch for review.
