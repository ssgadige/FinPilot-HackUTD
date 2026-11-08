# Proposed title

feat: integrate subscription, planning and agent-workspace frontends

# Proposed body

Related to #5, #6, #7 and #8.

Adds protected subscriptions, debt/readiness, goals/plans, assets, scenario and agent-workspace screens using the existing banking shell and actual API contracts. Preferences, goal saves, proposed intentions, server calculations and versioned plan acceptance use session cookies and CSRF; missing values and unavailable providers remain explicit. No money movement, merchant change, fabricated inference, institution-verification bypass or competing chatbot is included.

Preserves the separate accounts/snapshot/session integration fix currently present as uncommitted dependency work. Land/stage that dependency independently before creating this combined PR. Task-specific compatibility is limited to the current Institutions envelope and optional authorized CD maturity; no financial formula or database schema changes.

Validation: 73 component/session tests, 14 isolated backend tests, all 25 Chromium tests, typecheck and production build pass. Lint retains 92 existing errors and one existing warning with zero new findings. See the four IMPLEMENTATION.md files for desktop/mobile screenshots and check details. Labeled fixture screenshots are distinct from actual Mailpit/browser evidence.

Real two-user rehearsals verified fresh Mailpit login, session isolation, goal create/edit/reload, server hypothetical calculations, logout and former-cookie denial. Full journeys remain blocked by institution OTP wiring, connected data, missing offer resolver and absent run/chat HTTP integration. Plan 409 UI is covered by automated fixtures, not claimed as a successful real-plan demo. The teammate retains chatbot ownership.

These issues remain open while their unmet acceptance criteria are documented. No merge or issue closure is requested by this proposal.
