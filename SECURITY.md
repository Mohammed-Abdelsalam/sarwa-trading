# Security

This document describes how Sarwa Mini Trading protects accounts, sessions and personal data, and where it stops. Every control below names the module that implements it, so each claim can be checked against the code.

Sarwa Mini Trading is a paper-trading app. No real money moves. The things worth protecting are customer accounts, admin access, and personal data (emails, IP addresses).

## 1. Reporting a vulnerability

This is a take-home project, not a production service. If you find a vulnerability, report it **privately to the maintainer**. Don't open a public issue. Include:

- the affected app or package
- steps to reproduce
- the impact you expect

You will get an acknowledgement and, where it applies, a fix on a branch.

## 2. Threat model in brief

| Asset                       | Main threats                                                 | Primary controls                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Customer sessions           | Credential stuffing, token theft, refresh-token replay, CSRF | argon2id, lockout and rate limits, short access JWT, rotating refresh with reuse detection, httpOnly cookies, CSRF double-submit + Origin checks |
| Admin console               | Account takeover, privilege misuse, cross-site writes        | Separate JWT audience, `SameSite=Strict` cookie, ADMIN/VIEWER roles, same-origin write guard, audit log                                          |
| Personal data (emails, IPs) | Over-exposure to staff, long retention                       | Server-side masking by role, audited reveal, retention jobs                                                                                      |
| Web pages                   | XSS, clickjacking, script injection                          | Nonce CSP with `strict-dynamic`, `frame-ancestors 'none'`, security headers                                                                      |
| API availability            | Brute force, request floods, IP spoofing to dodge limits     | Global throttler, per-route limits, trusted-proxy handling of `X-Forwarded-For`                                                                  |

Out of scope: real payments, brokerage integrations, and anything that would need KYC.

## 3. Authentication & sessions

### Password hashing

Hashing lives in `apps/server/src/common/password-hasher.ts`.

- **argon2id** (`@node-rs/argon2`) for every new hash.
- **Legacy bcrypt admin hashes** are still verified. On the next successful sign-in they are re-hashed to argon2id (`needsRehash` in `apps/server/src/admin/admin-auth.service.ts`).
- **Dummy hash.** When an email is unknown, the hasher verifies against a dummy hash anyway. The work done and the response are the same either way, so timing doesn't reveal which emails have accounts. Unknown emails and wrong passwords get the same `INVALID_CREDENTIALS`; a locked account gets 429 until the lock ends; a suspended account gets its own error.
- **Password policy.** At least 8 and at most 128 characters, plus a built-in list of common passwords (`PASSWORD_POLICY` in `packages/domain/src/accounts.ts`). The web, mobile and the server all share the one schema (`NewPasswordSchema` in `packages/contracts/src/auth.ts`). Sign-in never reveals the policy.

### Tokens

Customer tokens are issued in `apps/server/src/auth/sessions.service.ts`. The TTLs come from `AUTH_TTL_MS` in `packages/contracts/src/constants.ts`.

- **Access token.** A JWT that lasts **15 minutes**, with `aud: 'customer'` and a `sid` claim (the session id).
- **Admin tokens.** These are signed with `aud: 'admin'` in `apps/server/src/admin/admin-auth.service.ts` and verified in `apps/server/src/admin/auth.ts`.
- **Audience separation.** Each verifier checks its own audience, so a customer token is never accepted as an admin token, and an admin token is never accepted as a customer token.
- **Refresh tokens** are opaque random values (32 bytes, `apps/server/src/auth/secrets.ts`). Only their SHA-256 hash is stored.
  - They last 30 days with "keep me signed in", otherwise 1 day.
- **Admin sessions** last 8 hours, or 7 days with "remember me".
  - Every request reloads the admin row, so a role change or a disabled account takes effect immediately.
  - Signing out bumps `tokenVersion`, which ends every token that admin holds.

### Refresh rotation and reuse detection

Rotation is handled by `SessionsService.refresh`:

- **Every refresh rotates the token.** The old row is marked `rotatedAt` and a new row joins the same session family.
- **Presenting a rotated token again means the token leaked.** The whole family is revoked and the caller gets 401 `SESSION_REVOKED`.
- **Tab-race grace.** Two tabs that refresh at once both send the same cookie. When a rotated token comes back within **10 seconds** (`REUSE_GRACE_MS`), the server treats it as that race, not as theft, and continues the live session.
- **Account state.** A suspended account, or one pending deletion, can't refresh.

### Revocation pushed over the socket

`SessionsService.revoke` publishes a `session.revoked` event. `apps/server/src/trading/trading.gateway.ts` then:

1. emits `session.revoked {v:1, reason, suspension?}` to that session's sockets
2. disconnects those sockets

The reasons are `signed_out`, `password_changed`, `suspended`, `revoked` and `deleted`. The clients end the session on receipt (`useAuthSync` in `packages/core/src/hooks/session.ts`).

Every access token is also checked against a live session row on each request (`SessionsService.authenticate`), so a revoked session stops working at once. It doesn't wait for the JWT to expire.

### Only 401/403 end a session

`isSessionRefused` in `packages/core/src/auth/session.ts` decides when a client gives up its session:

- **401 and 403** sign the user out.
- **5xx, 429 and network failures** keep the tokens. The client retries, and a launch without the server opens the app in offline mode.

This keeps a server outage or a rate limit from signing everyone out. Concurrent 401s share one refresh call, so a rotated token is never sent twice.

### Lockout and rate limits

Limits come from `AUTH_LIMITS` in `packages/contracts/src/constants.ts` and `apps/server/src/app.module.ts`. Over a limit, the server answers `429 RATE_LIMITED`. The auth rate limiter's 429 also carries `retryAfterSeconds` and a `Retry-After` header; the global throttler's 429 does not carry `retryAfterSeconds`.

| What                          | Limit                                                                                                                                                | Where                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Customer sign-in, per account | 5 failures in 15 min lock the account for 15 min                                                                                                     | `AuthService.recordFailure`               |
| Customer sign-in, per IP      | 5 failures in 15 min                                                                                                                                 | `AuthService.signIn`                      |
| Sign-up                       | 10 per hour per IP                                                                                                                                   | `AuthService.signUp`                      |
| Forgot password               | 3 per hour per email                                                                                                                                 | `RecoveryService.forgot`                  |
| Resend verification           | 1 per 60 s per email                                                                                                                                 | `RecoveryService`                         |
| Admin sign-in, per account    | 5 consecutive failed admin sign-ins lock the account for 15 min; a locked account is not counted again, so the lock can't be extended by an attacker | `AdminAuthService`                        |
| Admin sign-in, per IP         | 5 per minute                                                                                                                                         | `@Throttle` on `admin/auth.controller.ts` |
| Admin invite lookup / accept  | 10 / 5 per minute                                                                                                                                    | `admin/invites.controller.ts`             |
| Place order                   | 30 per minute                                                                                                                                        | `trading/orders.controller.ts`            |
| Every other route             | 120 per minute (health check excluded)                                                                                                               | `ThrottlerModule` in `app.module.ts`      |

Messages are generic, so none of them reveal whether an email exists. Forgot-password answers 202 whether or not the email exists (429 once over 3/h).

### Emailed links

Emailed links are handled in `apps/server/src/auth/one-time-tokens.service.ts`.

- **Password reset:** single-use, valid for 30 minutes.
- **Email verification:** valid for 24 hours.
- **Storage.** Like refresh tokens, only the SHA-256 hash of each link token is stored.
- **Effect of a reset.** A reset revokes every session; a password change revokes every other session.

## 4. Web

### Cookies

Session cookies are set in `apps/server/src/auth/transport.ts`.

| Cookie                            | Flags                                                    | Path                |
| --------------------------------- | -------------------------------------------------------- | ------------------- |
| `sarwa_access`                    | httpOnly, `SameSite=Lax`, `Secure` in production, 15 min | `/`                 |
| `sarwa_refresh`                   | httpOnly, `SameSite=Lax`, `Secure` in production         | `/api/v1/auth` only |
| `sarwa_csrf`                      | readable by JS, `SameSite=Lax`, `Secure` in production   | `/`                 |
| `sarwa_admin_session` (admin app) | httpOnly, `SameSite=Strict`, `Secure` in production      | `/`                 |

The web never sees a raw token. Tokens go to the web as cookies and to the mobile apps in the response body.

### CSRF

**Customer writes.** Any write made with the session cookie must pass `assertCookieWriteAllowed` (`apps/server/src/auth/transport.ts`). It requires all of these:

- **Double submit.** The `x-csrf-token` header must equal the `sarwa_csrf` cookie. Another site can't read that cookie.
- **Origin check.** The request must not be cross-site:
  - `Sec-Fetch-Site` must not be `cross-site` or `same-site`.
  - If an `Origin` header is present, its host must match the request host (`isCrossSite` in `apps/server/src/common/same-origin.guard.ts`).
- **Failure.** A failed check returns 403 `CSRF_FAILED`.

**Auth and admin writes.** `SameOriginGuard` is a global guard. It applies the same `Origin` / `Sec-Fetch-Site` check to every non-GET request under `/api/v1/auth/` and `/api/v1/admin/`.

**Mobile.** Bearer requests carry no cookies, so the CSRF check doesn't apply to them.

### Same-origin API proxy

Both Next apps rewrite `/api/*` and `/socket.io/` to the API (`apps/web/next.config.ts`, `apps/admin/next.config.ts`). The browser only ever talks to its own origin. As a result:

- cookies stay first-party
- `SameSite` holds
- the CSP's `connect-src` can stay tight

### Content Security Policy

Each request gets a fresh nonce, generated in `apps/web/src/proxy.ts` and `apps/admin/src/proxy.ts`. The policy itself is built by `contentSecurityPolicy` in `packages/ui/next-config.cjs`:

- `script-src 'self' 'nonce-…' 'strict-dynamic'`. `'unsafe-eval'` is added **in development only**, where React needs it to rebuild server error stacks.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` and `frame-ancestors 'none'`.
- `connect-src 'self'`, plus the API origin over http(s) and ws(s) on the web. The admin app uses its rewrite only, so its `connect-src` is just `'self'`.
- `upgrade-insecure-requests` when served over HTTPS.

**Zod runs jitless.** `packages/contracts/src/zod-config.ts` sets `z.config({ jitless: true })`. Otherwise Zod probes `new Function()` when it builds object schemas, which a CSP without `'unsafe-eval'` would block and report.

### Security headers

`securityHeaders` in `packages/ui/next-config.cjs` adds these headers to every route in both apps:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

Two more settings:

- The admin app also sends `X-Robots-Tag: noindex, nofollow`.
- Both apps set `poweredByHeader: false`.

## 5. Mobile

- **Bearer tokens in SecureStore.** The access and refresh tokens are kept in `expo-secure-store` (`apps/mobile/src/lib/secure-storage.ts`, `bearerAuth` in `packages/core/src/auth/transport.ts`).
  - The keychain item uses `AFTER_FIRST_UNLOCK`, so a background reconnect still works.
  - Refresh sends the token in the request body.
- **The saved user** (used to open cached data offline) is also kept in SecureStore under `sarwa.user`, never in plain storage. Sign-out deletes all three keys.
- **Device id.** The id that names a guest's paper account lives in SecureStore too. A value an older build left in AsyncStorage is moved into the keychain on first read.
- **No secrets in the app.** The only build-time values are `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL` (`apps/mobile/eas.json`), which are public URLs. Release builds refuse to start without an API URL (`apps/mobile/src/lib/api-url.ts`).
- **Backups.** Android `allowBackup` is `false` (`apps/mobile/app.json`).

## 6. Server

- **Default-deny guard.** `CustomerGuard` (`apps/server/src/auth/customer.guard.ts`) is a global guard: every route needs a signed-in customer unless it opts out.
  - `@Public()` opens a route to guests. It is used on stocks, candles, app config, trading status, health and the auth endpoints.
  - `@OptionalCustomer()` resolves a caller when there is one, without requiring it.
  - Admin routes use their own cookie and `AdminGuard`.
- **Zod validation.** Request bodies, queries and route params go through `ZodValidationPipe` (`apps/server/src/common/zod-validation.pipe.ts`), with schemas shared from `@sarwa/contracts`. Socket payloads are parsed with Zod too (`SubscribePayloadSchema`, `SocketAuthSchema`). Invalid input returns 400 `VALIDATION_FAILED` with field errors.
- **helmet and CORS** (`apps/server/src/main.ts`).
  - `helmet()` sets the API's headers.
  - CORS allows only `CORS_ORIGINS`, with credentials. It exposes the request-id header and `retry-after`, so clients can show support references and rate-limit countdowns.
  - The Socket.IO gateways use the same origin list.
- **Rate limiter.** `@nestjs/throttler` is the global guard. The sliding-window `RateLimiter` (`apps/server/src/common/rate-limiter.ts`) covers the auth flows. See the table in section 3.
- **Trusted proxies.**
  - Express `trust proxy` is set from `TRUST_PROXY`, which defaults to `loopback` (`apps/server/src/env.ts`).
  - Next fills `X-Forwarded-For` only when it is missing, which would forward a client-made-up address. So both Next apps register `forwardClientAddress` (`packages/ui/next-config.cjs`) in `instrumentation.ts`. It **appends** the real socket address to `X-Forwarded-For`.
  - The API reads the chain from the right, so the last hop is always real and a client can't spoof its IP to dodge per-IP limits.
  - Behind a load balancer, set `TRUST_PROXY` to its hop count or addresses.
- **Weak secrets refused in production.** `apps/server/src/env.ts` validates the environment at boot.
  - `JWT_SECRET` must be at least 16 characters in every environment.
  - When `NODE_ENV=production`, it must also be **at least 32 characters** and must not equal the example value from `.env.example`. Otherwise the server refuses to start.
- **Maintenance mode.** `WritableGuard` (`apps/server/src/common/device.ts`) answers 503 while the admin's `maintenanceMode` is on. It guards customer writes: placing, modifying and cancelling orders; creating, editing and deleting alerts; marking notifications read; registering push tokens; watchlist changes; and the customer's own paper-account reset. Reads keep working.
- **Opaque errors.** Errors use problem+json (`apps/server/src/common/problem-details.filter.ts`) with a stable `code`. Logs are JSON and carry a request id.

## 7. Admin & PII

- **Roles.**
  - `ADMIN` can do everything.
  - `VIEWER` is read-only: every write route carries `@Roles(['ADMIN'])`, and a VIEWER gets 403.
  - CSV export and IP reveal are ADMIN-only too.
- **Same-origin writes.** The admin cookie is `SameSite=Strict`, and `SameOriginGuard` refuses cross-site writes to `/api/v1/admin/`.
- **Masking happens on the server** (`apps/server/src/common/pii.ts`), so a VIEWER's browser never receives the raw values.
  - VIEWERs see emails masked as `s•••@example.com`. ADMINs see them in full.
  - IPs are masked for **every** role, e.g. `41.32.•.•`.
  - Audit payloads are masked deeply (`maskDeep`), since before/after snapshots can hold emails and IPs at any depth.
- **Audited reveal.** An ADMIN can reveal a customer's full session IPs (`POST /admin/customers/:handle/reveal`). Each reveal is logged as `customer.pii_viewed`. CSV export is logged as `customer.export`.
- **Audit log.** Admin actions, customer sign-ups, sign-ins, sign-outs, suspensions and resets are recorded (`apps/server/src/admin/audit.service.ts`).
- **Retention.** `RetentionService` (`apps/server/src/auth/retention.service.ts`) runs **every hour**. Each step is idempotent, so a restart never skips a day.
  - Audit events are deleted after **400 days** (`AUDIT_RETENTION_DAYS`).
  - Their IP is cleared after **90 days** (`AUDIT_PII_RETENTION_DAYS`).
- **Invites.** New admins join only by invite (`apps/server/src/admin/admin-invites.service.ts`).
  - Each token is hashed, single-use and valid for **48 hours**.
  - Every invite is audited as `user.invite`.
  - Resending issues a fresh link and revokes the old one.
- **Last-admin lock** (`apps/server/src/admin/admin-users.service.ts`).
  - An admin can't change their own role or status.
  - The last active ADMIN can't be demoted or disabled ("At least one ADMIN must remain active").

## 8. Data minimisation & retention

- **Session rows.** A session keeps a label, not a raw user agent: "Chrome on macOS" parsed with `ua-parser-js`, or the app name and phone model.
  - There is no GeoIP and no city.
  - The masked IP is stored next to the raw one, and lists show only the masked one.
- **Ended sessions.** Rotated, revoked or expired refresh rows are deleted 30 days after their last use.
- **Account deletion.** A deletion request revokes every session.
  - Signing in within 7 days cancels it.
  - After 7 days the hourly job anonymizes the user: email becomes `deleted-<id>@deleted.invalid`, the name becomes "Deleted customer", and the password hash is cleared. It also deletes sessions, reset tokens and verification tokens.
  - Orders, fills and the audit trail stay, for audit.
- **Audit log.** Kept 400 days, IPs cleared after 90 (see section 7).
- **Equity snapshots.** These are compacted to hourly after 2 days and daily after 90 days (`PortfolioService.compactSnapshots`).
- **Mobile cache.** The offline cache is scoped per user (see `docs/performance.md`). Sign-out deletes it, so the phone doesn't keep a signed-out user's portfolio.

## 9. Known limitations

These are deliberate trade-offs or open items. A production deployment should address them.

- **In-memory rate limits.** Both `RateLimiter` and the Nest throttler keep their counters in process memory. They assume a **single API instance**, and a restart resets them. Several instances would need a shared store such as Redis.
- **No real mailer yet.** Emails are never sent: `LogMailer`, the only `Mailer` (`apps/server/src/auth/identity.module.ts`), prints each link to the server log as JSON lines with `"context":"Mail"`. A real mailer is on the roadmap. Production needs a real mail provider, or anyone who can read the logs can take over accounts.
- **No two-factor authentication** for customers or admins.
- **The socket checks identity only at the handshake.**
  - If a socket reconnects with an expired access token, it is admitted as a **guest** and misses private events until the client's next HTTP refresh reconnects it with the new token (`reauthenticate` in `packages/core/src/market-socket.ts`).
  - The other way round, a socket that is already open keeps its private rooms past access-token expiry. Only a revocation or a disconnect ends it.
- **`style-src 'unsafe-inline'`.** The CSP allows inline style attributes. Chart geometry and Radix positioning set them, and they can't carry a nonce. Scripts are still nonce-only.
- **Raw IPs on live sessions.** The raw IP sits next to the masked one on live session rows, so an ADMIN can reveal it. It goes away only when the row is pruned.
- **Mobile offline cache in plain storage.** The persisted query cache (watchlist and portfolio) is in AsyncStorage, not SecureStore. It is scoped per user and deleted on sign-out, but it isn't encrypted at rest.
- **Admin sessions are stateless JWTs.** There is no per-device admin session list. Signing out ends **all** of that admin's sessions, through `tokenVersion`.
- **The audit trim clears only the IP.** The audit log has no user-agent column, so there is none to clear.
- **SQLite.** The database is a single SQLite file, with no encryption at rest beyond what the host provides.
- **Dev demo accounts.** Outside production, the seed creates demo customers with a shared, public password. The seed skips them when `NODE_ENV=production`, and it refuses to seed production admins unless their credentials are supplied.
