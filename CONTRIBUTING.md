# Contributing

## Issue workflow

The [GitHub project board](https://github.com/users/ssgadige/projects/1) tracks implementation. Each issue includes scope, implementation areas, dependencies, estimated effort and acceptance criteria. The corresponding specification is stored in `docs/tasks/FP-XX/README.md`.

Workstreams: **A — frontend**, **B — backend/data/security**, **C — Nemotron/agents**. Assign the selected issue to its developer before starting. Workstream identifiers do not imply a GitHub assignee.

Move an item from Todo to In Progress when work starts, then Review when a pull request is ready, and Done after it is reviewed and merged. Blocked work stays visible with the blocker recorded in the issue. Review is a board column; record blockers in the issue until a separate blocked status is needed.

## Branch and pull request

```bash
git switch main
git pull origin main
git switch -c feat/FP-01-app-shell
# Implement and verify the selected issue.
git add <changed-files>
git commit -m "FP-01: implement application shell"
git push -u origin feat/FP-01-app-shell
```

1. Open a pull request from the feature branch to `main`.
2. Include `Closes #<issue-number>`, a short description, and verification evidence. Add screenshots for UI changes.
3. Request review from another contributor. Resolve comments and failing checks.
4. Merge after approval and applicable checks pass. Prefer squash merge.
5. Delete the merged feature branch and pull the updated `main` before starting another issue.

Do not push application changes directly to `main` or force-push it. The review process documented here is a project policy; it is not a claim that branch protection has been enabled. Repository rules can be configured when account plan/access is confirmed.

## Shared contracts

Coordinate edits to SQL schema, API contracts and shared types. Backend owns authorization and calculation tools; agent work consumes those tools. Frontend uses the documented response contract. No separate per-developer app scaffolds.

## Completion criteria

- Issue acceptance criteria verified.
- Relevant tests and build checks pass.
- UI includes loading, empty, error and responsive states.
- Server enforces user ownership and validates tool arguments.
- Real, simulated and cached sources are labeled accurately.
- No API keys, OTPs, generated credentials, environment secrets or database files committed.

Jira is a separate integration and is not currently connected. GitHub Issues and Projects provide the active repository workflow.
