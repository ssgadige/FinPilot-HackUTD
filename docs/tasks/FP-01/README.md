# FP-01 — App scaffold and shared UI

| Field | Value |
|---|---|
| Workstream | A |
| Estimate | 1 hour |
| Dependencies | None |
| Priority | P0 |

## Scope
Create Next.js TypeScript scaffold without overwriting planning files; add shared shell, navigation, cards, forms, tables and chart wrapper. Commit lockfile and dev/build/lint/test scripts.

## Implementation area
src/app, src/components, package.json, lockfile

## Acceptance criteria
- [ ] App starts on localhost.
- [ ] All navigation sections reachable.
- [ ] Keyboard focus and mobile navigation work.
- [ ] Build/lint pass.

## Interface requirements
Implement the screen requirements in [UI design specification](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/UI_DESIGN.md). Use the shared banking visual system, responsive layouts, readable financial tables, accessible forms and complete loading/empty/error states. Include desktop and mobile screenshots in the PR.

## Pull request requirements
- Branch: `feat/fp-01-app-scaffold-and-shared-ui`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #1](https://github.com/ssgadige/FinPilot-HackUTD/issues/1)
