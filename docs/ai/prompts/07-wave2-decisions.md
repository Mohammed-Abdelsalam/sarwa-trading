# Wave 2: customer accounts, final decisions

Every agent reads these together with `agent-rules.md`, `05-accounts-design-spec.md` (the boards: copy, states, screens) and Phase 4 of `04-master-plan.md`. Where they conflict, **this file wins**.

## Identity and model

- **One customer = one `User`.**
  - Fields: email (unique, lower-case), name, passwordHash, status `active|suspended|deleted`, emailVerifiedAt, failedLogins, lockedUntil, deletionRequestedAt, signupPlatform `web|ios|android`, createdAt, lastActiveAt, plus a suspension record: reason category, reason text, at, by.
  - A user owns exactly one paper `Account` through `Account.userId` (unique). `Account.deviceId` becomes nullable.
- **Guest = the existing device-scoped paper account.** It is the "anonymous account" in the design (G4).
- **Public id = the existing `Account.handle` (`ACC-XXXXXX`).** No `@handle` and no new publicId (G14/G15 dropped). The admin "Handle" column shows `ACC-…`. The customer "edit profile" changes the name only.
- **Watchlist requires an account.** Guests can't star. Move `WatchlistItem` and `PushToken` ownership to Account (or User) as part of the auth server work. Existing device rows migrate to that device's account.

## Auth and sessions

- **Passwords:**
  - Customers use argon2id (`@node-rs/argon2`).
  - Admins keep verifying bcrypt and are re-hashed to argon2id on their next successful login.
  - One `PasswordHasher` picks the algorithm from the hash prefix (G1).
  - Minimum 8 characters, plus a small built-in list of common passwords (`WEAK_PASSWORD`).
- **Tokens:**
  - The access JWT lasts 15 min, with `aud: 'customer'` and a `sid` claim. Admin tokens keep `aud: 'admin'`.
  - Refresh tokens are opaque and rotate on every use. Reusing an old one revokes the whole family.
  - Refresh TTL is 30 days with "keep me signed in", otherwise 1 day. `keepSignedIn` is stored on the Session (G2).
- **Session row:** id, userId, familyId, refreshHash, keepSignedIn, platform, label (from `ua-parser-js` on web; device model sent by mobile), ipMasked + ip, createdAt, lastUsedAt, expiresAt, revokedAt.
  - **No GeoIP and no city** (G18). The design's location text becomes the label plus the masked IP.
- **Web transport:**
  - The web app proxies `/api` and `/socket.io` same-origin, like admin.
  - Cookies: an httpOnly Secure SameSite=Lax access cookie, plus a refresh cookie on path `/api/v1/auth`.
  - Mutations need a double-submit CSRF token (readable `csrf` cookie + `X-CSRF-Token` header) **and** the Origin check (G3).
  - Server components never read personal data through the 5-second cached fetchers.
- **Mobile transport:** `Authorization: Bearer <access>`. The refresh token lives in SecureStore, and refresh goes in the body.
- **Global guard:** default-deny, with `@Public()` on stocks, candles, app-config, trading status, health and the auth endpoints. Personal routes return 401 `UNAUTHORIZED` to guests.
- **Abuse limits** (`429 RATE_LIMITED` with `Retry-After`):
  - Sign-in: 5 failures per 15 min, per account and per IP. Five failures lock the account for 15 min.
  - Forgot password: 3 per hour per email. Sign-up: 10 per hour per IP. Resend verification: 1 per 60 s.
  - Every message is generic, so none reveals whether an email exists.
  - Copy for the lock: "For your security we paused sign-in on this account for a few minutes." (G20)
- **Links:** reset tokens are hashed, single-use and live 30 min. Verify tokens are hashed and live 24 h.
  - Email goes through a `Mailer` abstraction. Dev and test use `LogMailer`, which prints the link.
- **Socket:** the handshake carries the access token (or the web cookie) and joins `user:<userId>` and `acct:<accountId>`; guests join only public rooms.
  - On suspend, password change, "sign out all" or a revoked session, the server sends `session.revoked {v:1, reason, suspension?}` and disconnects.
- **Claim vs discard** (G21):
  - Sign-up from a device with a guest paper account re-parents that account to the new user, in one queued transaction.
  - Sign-in when that device's guest account has orders or positions returns `409 GUEST_DATA_PRESENT` with a 2-minute ticket. Re-submitting with the ticket discards the guest data (deletes that device account), then signs in. Cancel keeps the guest state.
  - Never merge two portfolios.
- **Suspension** (G5, G22, G23):
  - Suspending sets the status, revokes all sessions, cancels open orders with cancelReason `account_suspended` and emits `session.revoked`.
  - Sign-in returns `403 ACCOUNT_SUSPENDED` with `suspension{reasonCategory, reason, at, accountId}`.
  - Reason categories: `abuse` (automated trading scripts), `fraud`, `terms`, `customer_request`, `other`. Free text is 10–280 characters.
- **Delete account** (G16): the customer confirms with password plus a typed DELETE.
  - This sets `deletionRequestedAt` and revokes all sessions.
  - Signing in within 7 days cancels the deletion, with a toast.
  - A daily job purges after 7 days: it anonymizes the email, frees the address, deletes sessions and marks the account deleted. Financial history stays for audit.
- **Self-reset** (G17): a customer can reset their own paper account with a typed RESET, using the existing reset logic. It is audited as `account.reset` with actor `customer`.
- **On sign-up:** a welcome notification (G26), and `signupPlatform` is stored (G25).

## Admin

- **Customers:**
  - Nav order: Overview · Market · Trading · Orders · **Customers** · Stocks · Config · Audit log · **Team**.
  - `/accounts` redirects to `/customers`. `/users` redirects to `/team` (G10, G11).
- **Customers list:**
  - KPIs: registered, signed up today with the % from mobile, active in 24 h, suspended, % verified, and guest visitors in 24 h with conversion (G24).
  - Search by email, name or ACC id. Filters: status, verified, has open orders.
  - Server-side cursor pagination; the table is virtualized at 56 px rows.
- **Customer detail:** tabs Overview / Orders / Sessions / Activity.
  - Actions: Suspend or reactivate (reason required), Sign out all devices, Send password reset, Reset paper account (typed `RESET ACC-…`).
  - Every action is audited.
- **PII** (G6, G19):
  - ADMIN sees full emails. VIEWER sees masked emails (`s•••@example.com`).
  - IPs are masked for every role (`41.32.•.•`). The Sessions tab has an ADMIN-only "Show full IPs" → `POST /admin/customers/:id/reveal`, audited as `customer.pii_viewed`.
- **Export CSV:** ADMIN only, audited as `customer.export`. For VIEWER the button is disabled with a lock and a tooltip (G7).
- **Team:**
  - Creating a user with a password is replaced by `AdminInvite`: a hashed token, 48 h, single-use, audited as `user.invite`.
  - The accept page `/invite/[token]` uses the login card with name and password.
  - No 2FA column (G9). Your own row stays locked, and at least one ADMIN must remain.
- **Overview:** "Registered customers" and "Guest visitors" cards replace "Devices".
- **Audit:** adds chips for `customer.*`, `user.invite`, `account.reset`, `customer.pii_viewed` and `customer.export`.
  - Events are kept 400 days; ip and user agent are anonymized after 90 days by a job (G30).

## Clients

- **Guest landing** on web `/` and on the mobile Home tab: a hero, Create account / Sign in, live top movers, the sector heatmap and three "how it works" steps.
  - Signed-in users get today's dashboard. Both modes come from one core `useHomeView()`.
- **Gating:**
  - `useRequireAuth(intent)` in core stores the intent for 10 minutes and opens the gate: a web modal, a mobile bottom sheet.
  - After sign-in or sign-up the user lands back on the action. Orders are never auto-submitted: the ticket reopens prefilled.
- **Settings and account:**
  - Web: `/settings/[section]`. Profile and Security render on `security`; notifications, appearance and trading wrap the existing settings; danger is its own page (G13). Plus `/suspended`.
  - Mobile: an `(auth)` group, the Account tab, Security/sessions, and a "You were signed out" sheet.
- **Copy:** every string goes in `@sarwa/i18n` in EN **and AR** (translate every "AR —" from the spec). Error codes map to the copy in the Dev-AuthNotes table.
- **Locale:** the cookie locale stays. Ignore `/ar` URLs (G12).
- **Push** (mobile): register the Expo push token after sign-in and delete it on sign-out. Ask for permission after sign-in, never at launch.
