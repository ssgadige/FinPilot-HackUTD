# Three-person start

The GitHub repository is the source of truth. Jira is deferred until tools are connected; docs/TASK_BOARD.md and docs/jira-import.csv already contain the tasks.

1. Everyone opens the same repository in VS Code; do not copy source manually between machines.
2. Map A, B, C to team members. A owns UI, B owns backend, C owns agents. Actual teammate usernames are still needed for invitations and assignments.
3. All three read API.md, SECURITY.md, and contracts/types.ts. Freeze contract v1 in the first hour.
4. B runs the seed and data validation. A implements against documented response fixtures until B's endpoints are ready. C uses the same seeded data through authorized tools.
5. C obtains a successful real Nemotron tool-call round trip by hour 2; B obtains password + email challenge + authenticated session by hour 3.
6. Integrate a narrow login → link → forecast → real agent finding flow by hour 6. Add the remaining capabilities to that running flow.

## Git workflow

```bash
git clone https://github.com/ssgadige/FinPilot-HackUTD.git
cd FinPilot-HackUTD
git switch -c feat/FP-01-app-shell
# Work, verify, then stage only intended files.
git add <files>
git commit -m "FP-01: add application shell"
git push -u origin feat/FP-01-app-shell
```

Open a PR with task ID, result, verification and limitations. Review small PRs frequently. Pull updated main before each task. Never force-push main. B owns schema/API changes; C owns agent contracts/prompts; A owns components/styles. Shared files require a quick team check before editing.

## Definition of done

UI connected to actual API, authenticated and authorized backend, useful empty/error/loading states, calculations checked, agent/tool trace retained, no secrets, no cross-user leakage, reviewer acceptance. UI placeholders and scripted model-like messages are not completed agent features.

## Later external setup

Connect Atlassian and choose a Jira site/project, then import the prepared backlog. Do not assume a GitHub Projects board is Jira. Add collaborators after verifying their GitHub usernames. Add NVIDIA credentials, verified sender/SMTP settings and deployment secrets outside git. No external service has been configured by this handoff.
