# ADR 0008: Customer accounts and sessions

## Status

Accepted. Replaces the original plan of a device id instead of auth.

## Context

The first version identified a client by a random device id only. That cannot follow a person across devices, cannot be signed out, and gives no place for an admin to act on a customer. Customers now sign themselves up (admins manage them but never create them). The same API serves a browser (where tokens must not be readable by JavaScript) and native apps (where cookies are awkward and secure storage exists). Browsing prices should stay open to everyone.

## Decision

**Passwords**

- argon2id through `@node-rs/argon2`. One `PasswordHasher` picks the algorithm from the hash prefix: older bcrypt admin hashes still verify and are re-hashed to argon2id at the next sign-in.
- An unknown email still runs a dummy verify, so timing does not reveal whether an account exists. Unknown emails and wrong passwords get the same `INVALID_CREDENTIALS`; a locked account gets 429 until the lock ends; a suspended account gets its own error.
- At least 8 characters, plus a built-in list of common passwords.

**Tokens and sessions**

- Access token: a JWT that lives 15 minutes, with `aud: 'customer'` and a `sid` (session) claim. Every request also checks that the session row is still live and the user is active, so a revoked session or a suspension takes effect at once.
- Refresh token: opaque, stored only as a SHA-256 hash, and **rotated on every use**. A session is a family of refresh rows.
  - Reuse of an old token within 10 seconds is treated as a race between tabs and still works.
  - Reuse after that revokes the whole family (401 `SESSION_REVOKED`), and the socket gets `session.revoked`.
- Refresh lives 30 days with "keep me signed in", otherwise 1 day.

**Transport per platform** (the server picks by request):

- **Web: cookies.** `sarwa_access` (httpOnly, `SameSite=Lax`, path `/`), `sarwa_refresh` (httpOnly, path `/api/v1/auth` only), and `sarwa_csrf` (readable by JavaScript). `Secure` is set in production.
  - Every cookie-authenticated write needs the double-submit token (`x-csrf-token` equal to the `sarwa_csrf` cookie) **and** must not be cross-site (`Sec-Fetch-Site` and `Origin` checks). A failure returns 403 `CSRF_FAILED`.
  - The web reaches the API through Next rewrites, so all of this is same-origin (ADR 0002).
- **Mobile: bearer tokens.** `Authorization: Bearer <access>`. Both tokens are kept in `expo-secure-store`; refresh sends the token in the body. Sign-up and sign-in return tokens in the body when `x-client-platform` is `ios` or `android`.

**Default-deny guard**

- `CustomerGuard` is a global guard: every route needs a signed-in customer unless it is marked `@Public()` (stocks, candles, app config, trading status, health, auth endpoints) or `@OptionalCustomer()` (for example the watchlist, ADR 0009). Admin routes use their own guard (ADR 0012).
- Abuse limits (429 `RATE_LIMITED` with `Retry-After`): 5 sign-in failures in 15 minutes lock the account for 15 minutes, with a per-IP limit too; sign-up 10 per hour per IP; forgot password 3 per hour per email; resend verification once a minute.

**Guests and the gate**

- Guests browse everything public: prices, charts, markets, stock pages. Personal routes return 401 to them, and guests cannot trade.
- In the clients, `useRequireAuth().run(intent, action)` in core opens the sign-in gate (a dialog on web, a bottom sheet on mobile) and saves the intent for **10 minutes** (`AUTH_TTL_MS.authIntent`). After sign-in or sign-up, `useResumeIntent` returns it once: an order ticket reopens prefilled (never auto-submitted), an alert form reopens, or the user lands on the portfolio, orders or notifications screen they asked for. Starring needs no sign-in (ADR 0009).

**Lifecycle**

- Email verification, password reset (hashed single-use links, 30 minutes), sessions list with per-device sign-out, suspension (revokes sessions, cancels open orders), and account deletion with a 7-day grace period, after which a job anonymizes the user and keeps the financial history.
- Emails are never sent: `LogMailer`, the only `Mailer`, prints each link to the server log as JSON lines with `"context":"Mail"`. A real mailer is on the roadmap.

## Why

- argon2id is the current OWASP recommendation for password hashing.
- Short access tokens plus rotating refresh tokens limit the damage of a leaked token; reuse detection catches a stolen refresh token.
- httpOnly cookies keep tokens out of reach of any script on the web; SecureStore is the native equivalent on mobile.
- Default-deny means a new route is private unless someone decides otherwise.
- Guest browsing keeps the product open; the gate with a saved intent turns interest into sign-ups without losing what the user was doing.

## Alternatives considered

- **A hosted identity provider (Auth0, Cognito, Clerk):** less code, but an external account for reviewers and less control over the guest claim flow.
- **Long-lived JWTs without refresh:** simpler, but cannot be revoked.
- **Tokens in localStorage on web:** rejected; any XSS could read them.
- **One transport for both platforms:** cookies are awkward in native apps; bearer tokens on web need JavaScript-readable storage.

## Consequences

- Good: revocation is immediate (suspend, sign out everywhere, password change) on both REST and sockets.
- Good: one server, two transports, chosen per request; the core client hides the difference (`webCookieAuth`, `bearerAuth`).
- Bad: every authenticated request reads the session row, a database hit that a stateless JWT would avoid.
- Bad: rate limits and lockout windows are in memory (ADR 0013), so they reset on restart and assume a single instance.
- Bad: a lot of surface to test and maintain: CSRF, rotation races, claim and discard paths, deletion jobs.
