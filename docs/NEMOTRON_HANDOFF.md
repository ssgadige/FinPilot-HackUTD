# Nemotron live validation handoff

The UI, deterministic calculator tools, scoped credit profiles and fixed official lender lookup are implemented. Automated inference tests use mocks; live NVIDIA validation is outstanding. Keep Nemotron as the only language model. Do not paste keys into chat, source, logs, screenshots or commits.

Copy this prompt into Codex on the machine with the NVIDIA configuration:

```text
Validate the merged FinPilot credit/coach upgrade using the existing Nemotron provider.
First inspect git status and preserve ongoing work, .env secrets and the current database.
Pull current main safely; install locked dependencies and rebuild/restart using the existing
local/Docker setup. Do not reseed/reset an existing database. Read docs/API.md,
docs/SECURITY.md, docs/AGENTS.md and docs/fixes/credit-coach-upgrade.md.

Use the locally configured NVIDIA_API_KEY and NEMOTRON_MODEL (confirm actual config
names in src/server). Never print keys. Do not switch model providers or fake a response.
Log in through the real email OTP flow. On Credit health, explicitly connect FinPilot
Demo Credit Monitor. Confirm a distinct owner-scoped report; disconnect hides it and
invalidates prior evidence. Verify another user's report/run ID is inaccessible.

Run the real checkup. Review the new result cards and Explain finding handoff. Confirm
only actual supported findings appear and failed/skipped/stale specialists retain labels.
Explain an owned current completed run directly in chat; do not expose raw JSON or keys.

Test these real chat prompts:
1. Calculate a $12,000 loan at 0% APR over 12 months. Verify $1,000 base payment.
2. Calculate a $20,000 loan at 6% APR over 60 months with $100 extra monthly.
   Verify the rendered figures match server calculator output, including extra payment.
3. Calculate a $20,000 loan over 60 months. Ask for APR; never invent a market rate.
4. I have $1,000 saved; save $6,000 over 12 months at 0% APY.
5. Find current official auto loan offers. Check fresh tool attempts, allowlisted official
   links and retrieval status. A blocked/unrecognized page must remain unavailable.
6. Can I qualify for that loan? Explain missing income/debt/underwriting criteria.
   Do not invent a probability, guaranteed approval or full/partial approved amount.

If actual Nemotron tool/schema behavior needs correction, fix only the observed issue,
keep strict schemas/evidence/session checks, run meaningful tests, and retain a sanitized
trace proving model identity, real tool calls, source status and accurate rendered output.
No payments, transfers, applications, cancellations or real credit pulls. No live-term,
real-bureau or fully-wired-specialist claim without actual evidence. Keep fixture labels.
Report live PASS/FAIL and remaining limitations separately from mocked test results.
```

## Current boundaries

- Credit data is generated demonstration data for the ten existing users; the monitor requires consent and persists until disconnected.
- Public lookup covers fixed official product pages. It is not unrestricted web search, verified APR extraction or a full-market comparison engine. Human review of current lender terms is required.
- Existing specialist availability is preserved. This change does not complete previously unavailable specialist/backend integrations.
- New model tools have strict input/evidence validation. Live tool selection, latency and provider compatibility still need the real-key test above.
