# Jira setup — deferred until connected

No Jira board has been created by this repository handoff. Atlassian connection, site/project selection, project permissions and teammate identities are still needed.

Create a team Kanban project named FinPilot HackUTD (suggested project key FIN). Configure Backlog, Ready, In progress, Review, Done, Blocked. Import jira-import.csv using Jira CSV import. Map Summary, Description, Issue Type, Priority and Labels; map Estimate hours/Owner lane/Dependencies/Task ID to custom fields if available, otherwise keep them in Description. Map Status only if importer permits it. The FP IDs are stable repo references; Jira assigns its own issue keys. This file does not assert Jira import support for your project configuration.

Map lane-a/b/c to actual team members after verifying identities. Imported descriptions contain the complete task README and repo link. Convert dependency references to Jira issue links after import. Jira is separate from GitHub Issues/Projects; do not call one the other. For now the full board exists in TASK_BOARD.md with 24 task READMEs.
