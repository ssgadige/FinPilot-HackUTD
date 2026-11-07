# Security implementation requirements

This is a simulated financial prototype, not production banking or a compliance certification. These are required acceptance conditions, not claims of completed controls.

## Authentication and verification

- Application password and institution simulator password are separate. Hash with scrypt; seed format is scrypt$16384$8$1$hexSalt$hexDigest (32-byte output). Verify using constant-time comparison. Production credentials must never be reused here.
- Password then email code; do not create an authenticated finance session until code verification. Email verification is a convenience second step, not phishing-resistant banking MFA.
- Generate a cryptographically random 6-digit code, HMAC it with a server-only secret, expire after 5 minutes, single use, at most 5 attempts. Resend cooldown 60 seconds and invalidate older codes. Challenge bound to user and pending-login cookie. Code delivery failure must not bypass verification.
- Local Mailpit supports fictional example.test users. Real SMTP requires verified sender and explicitly configured owned inboxes; do not send to invented real addresses. No master OTP, public inbox or hidden bypass in deployed builds.
- Generic login errors; per-IP and per-account throttling; no account enumeration. Expire pending challenges and clean stale sessions.

## Sessions and requests

- Opaque random 32-byte session token, store only its SHA-256 hash; HttpOnly, SameSite=Lax, Secure cookies with HTTPS (local HTTP exception explicit). Rotate at completed authentication. 30-minute inactivity and 8-hour absolute expiry. Logout invalidates server token.
- Same-origin unsafe request protection using Origin validation and CSRF token. No wildcard credentialed CORS. Require reauthentication for email/security changes; omit those changes if not implemented safely.
- Authenticate every page/API route and re-check ownership for each account, connection, transaction, run, goal, plan, event and evidence object. Never trust a client or model-supplied user_id.
- Parameterized SQL and strict input schema validation, pagination/size/date limits, HTML-safe rendering and no unsanitized model HTML. Redact account numbers except last four.

## Simulator boundaries

Prominent fake-login warning; only known generated demo usernames accepted. Validate selected account ownership. Store password hashes, not entered credentials; never pass them to Nemotron. Simulator authenticates to its own local tables, never to actual banks. Consent scopes restrict tools to linked selected accounts. Disconnect revokes access; invalidate cached findings and mark affected plans stale. History access after disconnect is disabled in the demo.

## Model and tool controls

Server-only NVIDIA key. No passwords, codes, sessions, SMTP secrets or unnecessary personal fields in model context. Merchant strings and retrieved offer text are untrusted data. Tool names fixed by allowlist; arguments validated. Session-bound identity injected outside model control. No shell/SQL execution tools, no arbitrary URL fetching. Enforce time/call budgets and trace every tool action without secret arguments. Evidence gate checks object ownership and source references. No tool grants authority to transfer money, cancel subscriptions or purchase plans.

## Offers and network

Only HTTPS provider allowlist; block private/loopback/link-local destinations, disallow redirects to non-allowlisted hosts, bound response size and timeout; never fetch user-supplied URLs. Parse inert text, not executable pages. Display retrieval time, source and availability. No offer savings accepted without comparable terms and explicit user choice.

## Deployment and data

Keep env values and generated credentials/DB out of git. Restrict file permissions, bind local SMTP/inbox to localhost, HTTPS on any shared deployment, persistent server storage and secrets in hosting secret manager. Minimize logs; no raw chat, auth headers, OTPs or full statements in analytics. Synthetic data only during judging. Do not invite real financial data into this prototype.

## Mandatory verification

Wrong password; wrong/expired/replayed code; throttling; no session before second step; logout; two-user object access (read and mutation); disconnected data inaccessible; model tool user_id manipulation; malicious merchant text; invalid tool arguments; SSRF/redirect rejection; missing provider credentials; idempotent event/sync; concurrent plan acceptance; no secret strings in browser bundle/logs. Tests must verify behavior, not just that checks exist in code.

Sources: OWASP Authentication, Session Management and Multifactor Authentication Cheat Sheets (see SOURCES.md).
