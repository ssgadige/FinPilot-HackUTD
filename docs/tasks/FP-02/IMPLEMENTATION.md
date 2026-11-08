# FP-02 implementation and integration handoff

Implemented on the existing `feat/fp-02-login-and-email-verification-screens` branch. Issue #2 is not closed. No push or merge is included.

## Delivered frontend

- `/login`: responsive sign-in form with visible labels, email/password validation, password visibility toggle, submission feedback and generic credential errors. Uses the FP-01 buttons, cards, fields, page headings, status components and visual tokens.
- `/login/verify`: masked recipient from the login response, a single accessible six-digit field with whole-code paste and `one-time-code` autocomplete, verify action, resend cooldown and change-email/back action. Password and code are held only in React memory. The challenge ID and masked recipient are also memory-only; reloading the page requires signing in again because no challenge-recovery endpoint is documented.
- Wrong/expired code, rate limiting, session expiry, network failure, malformed response and unavailable-service states. Known machine codes map to local user-facing text; arbitrary server messages are not displayed. Form values survive recoverable network errors. Passwords clear after the login challenge; codes clear after submission and resend.
- Five-minute code window and sixty-second resend cooldown follow `docs/SECURITY.md`. `Retry-After` controls the rate-limit wait. Timers support the UI only; FP-10 must enforce expiry, attempts and cooldown on the server. A server-expired challenge stays disabled if resend fails.
- `GET /me` confirms the session on mount and after verification. A successful verification response alone does not grant access. Pending/anonymous/unavailable sessions do not display financial navigation or content.
- Logout requires a server-supplied CSRF token, posts to the backend, and clears client identity and returns to login only after HTTP 204. Failures retain the session and state explicitly that revocation is unconfirmed. The browser owns the cookies; the frontend does not read or manufacture session cookies or persist credentials/tokens in browser storage.
- Requests use same-origin credentials, no-store, a fifteen-second timeout, cancellation on unmount, strict expected response statuses, and local response-shape checks. No mock responses, login bypasses, demo passwords or accepted OTPs exist in application code.

## FP-10 blocker — end-to-end authentication is unavailable

Inspection found no implementation of `src/app/api/v1/auth/*`, `/api/v1/me`, or a server session validator before this task. Real `/api/v1/me` and login requests currently return 404. The app displays an honest unavailable-service state. No Mailpit delivery, password verification, session revocation or end-to-end authentication is claimed.

The existing FP-01 routes are preserved under the `(workspace)` route group, at their original URLs. The server layout and each page call `src/server/auth/session.ts`. This is an explicit **deny-all integration boundary**, not a session validator: it redirects to login until FP-10 supplies trusted verified-session enforcement. It never accepts cookie presence, client `/me` results, an environment switch or a fabricated identity as authorization. The additional client `WorkspaceGate` is a visibility/UX boundary only.

All fourteen existing workspace URLs are blocked, even with JavaScript disabled, a forged session cookie, or a test-mocked successful browser `/me` response. Next.js may stream its loading boundary before emitting a redirect, returning a 200 response with a redirect instruction rather than an initial 307; tests check both forms and assert that the response contains no fixture financial content. The old FP-01 public-preview browser checks were updated to this stricter boundary; the original components and FP-01 evidence remain preserved.

Financial API routes do not exist on this branch. Future FP-10/FP-12 handlers must independently validate authenticated user scope and ownership. A page layout or client gate does not protect an API. These server controls remain an integration blocker; financial routes must remain closed until they are supplied and verified.

## Backend coordination needed

The API contract and shared contract types were not edited. The adapter implements the documented `/api/v1` routes:

| Operation | Request | Expected response |
| --- | --- | --- |
| Login | `POST /auth/login`, `{email,password}` | 202, `{challenge_id,masked_email}`, pending server cookie |
| Verify | `POST /auth/verify`, `{challenge_id,code}` | 200, authenticated server cookie; followed by successful `GET /me` |
| Resend | `POST /auth/resend`, `{challenge_id}` | 202, generic response |
| Session | `GET /me` | 200, safe `{id,display_name,email,...}`; 401 means unauthenticated |
| Logout | `POST /auth/logout`, empty JSON and `X-CSRF-Token` header | 204 only after revocation |

FP-10 must confirm the following integration details before the real journey can work:

1. Implement the endpoints, secure/pending cookies, password and code verification, Mailpit delivery, throttling, Origin/CSRF validation, revocation, and the trusted session helper. Replace the deny-all helper with that validator without weakening the existing checks.
2. The contract names a logout CSRF token but does not define delivery or transport. The isolated adapter currently proposes a **session-bound `X-CSRF-Token` response header on `GET /me`**, echoed in the logout request header. This is an unconfirmed integration choice, not an existing backend capability or session token. Missing token means logout is unavailable and no unsafe request is sent. Coordinate this with FP-10 or adapt this one boundary to its supported mechanism.
3. Confirm status 200 for successful verification and string profile IDs. The contract describes these responses without a complete wire schema.
4. Confirm stable error codes: `CODE_EXPIRED`/`OTP_EXPIRED`/`CHALLENGE_EXPIRED`, `SESSION_EXPIRED`/`CHALLENGE_NOT_FOUND`, and `Retry-After` for 429. Verify 400/401 falls back to a generic wrong-code error; login 401 is generic and does not enumerate accounts. Unknown/server errors remain unavailable. No backend error strings are trusted as instructions or rendered HTML.
5. Backend challenge/session recovery is not specified. A browser reload discards a pending challenge and directs the user back to login rather than persisting a secret or inventing recovery.

## Visual reference and screenshots

Reviewed the attached `FinPilot_All_Screens_and_Task_Guide.pdf`, pages 6–9: FP-02 handoff, “Welcome back,” “Check your email,” and “That code has expired.” Shared colors, typography, cards and fields come from FP-01. PDF annotations remain outside the product. All text and controls are semantic HTML/React, never rendered PDF pages.

- [Desktop login, actual unavailable backend](evidence/login-unavailable-1440.png)
- [Mobile login, actual unavailable backend](evidence/login-unavailable-390.png)
- [Desktop verification, automated-test fixture](evidence/verification-fixture-1440.png)
- [Mobile verification, automated-test fixture](evidence/verification-fixture-390.png)
- [Mobile expired code, automated-test fixture](evidence/expired-code-fixture-390.png)

Verification screenshots use network responses confined to automated tests and are explicitly fixture evidence. They do not prove actual email delivery or authentication. Login screenshots show the real unavailable service and field validation. Screenshots were reviewed for layout, visible simulation labels, readable errors and unclipped controls at 1440px and 390px.

## Checks

Run with `npm ci`, then `npm run dev` and visit http://localhost:3000/login. On restricted PowerShell installations use `npm.cmd`.

Verified on Windows with Node 24.22.0. The repository baseline remains Node 22.13+.

| Command | Final result |
| --- | --- |
| `npm run build` | Pass |
| `npm run lint` | Pass, zero warnings |
| `npm run typecheck` | Pass |
| `npm test` | 16 tests pass |
| `npm run test:e2e` | 7 Chromium tests pass |
| `git diff --check` | Pass |

Component tests cover login/challenge, code errors/paste, expiry persistence, resend and rate-limit timers, network failure, response validation, session confirmation, pending visibility, logout success/failure and missing CSRF; they retain FP-01 form tests. Browser tests cover the real missing-backend UI, test-only verification states, keyboard/skip navigation, automated accessibility scans, responsive screenshots, network and logout flows, and real server denial checks. Accessibility scans pass on the login/validation, verification and expired-code screens tested; they do not replace a screen-reader review.

The server-denial tests are real runtime checks. Successful authentication/logout transitions are frontend tests with mocked backend responses. FP-10 security verification and a real login → email → verified session → authorized finance → revoked logout journey remain outstanding.

## Changed-file inventory

| Files | Change |
| --- | --- |
| `src/app/login/page.tsx`, `layout.tsx`, `verify/page.tsx` | Public login/verification routes and PDF-aligned frame |
| `src/components/auth/auth-flow.tsx`, `auth-frame.tsx`, `auth-provider.tsx`, `auth.css` | Forms, challenge lifecycle, session state, responsive design |
| `src/components/auth/logout-button.tsx`, `workspace-gate.tsx` | Confirmed logout and pending-auth visibility |
| `src/lib/auth-api.ts` | Typed same-origin adapter and safe error mapping |
| `src/server/auth/session.ts` | Explicit fail-closed FP-10 integration boundary |
| `src/app/(workspace)/layout.tsx` | Server-gated workspace layout |
| `src/app/(workspace)/page.tsx`, `[section]/page.tsx`, `ui/page.tsx`, `ui/pattern-form.tsx` | Existing FP-01 files moved without URL changes; server checks added to pages |
| `src/app/layout.tsx`, `globals.css` | Shared auth provider/styles and semantic data-state headings |
| `src/components/app-shell.tsx`, `src/components/ui/data-state.tsx` | Profile/logout navigation and configurable heading levels |
| `package.json`, `package-lock.json` | Add and lock `server-only` |
| `tests/ui/auth.test.tsx`, `pattern-form.test.tsx` | Auth interaction suite and moved component import |
| `tests/e2e/auth.spec.ts`, `scaffold.spec.ts` | Auth browser evidence and server access-denial regressions |
| `docs/tasks/FP-02/IMPLEMENTATION.md`, `evidence/*.png` | This handoff and five labeled screenshots |

Original planning files, API documentation, shared contracts, and FP-01 evidence are unchanged. Changes remain local on the current branch.
