# 05 — Accounts & auth: implementation spec (from Claude Design v3 boards)

> Repo copy: Arabic board copy is replaced by `[AR]`. The shipped Arabic strings live in `packages/i18n`.

Source: `design-v3/project/*.dc.html` (page "Accounts & auth (v3)"). The customer boards (X-, W-, M-, Dev-) are static markup with empty `renderVals()`, so all copy below is taken from the markup. The admin boards (A-*) keep their data and copy in `renderVals()`. "AR —" means the board has no Arabic text for that string, so it still needs translating. Proposed i18n keys are nested objects in `packages/i18n/src/messages/{en,ar}.ts` (customer) and `admin-{en,ar}.ts` (admin).

---

## 1. Boards

### 1.1 W-Auth (web auth pages)

Layout: a centered auth card on the app background. Header: Logo + "Back to markets". Below it: title, the value line, the form, an "or" divider, then disabled Google/Apple buttons with a "Soon" badge, and a secondary link at the bottom. Components: `Logo`, `Card`, `Field`+`Input` (password with a show/hide `IconButton`), `Banner` (top error), `Button` (loading = `Spinner` + label), checkbox, `Badge` "Soon", a strength meter (**new**: 3–4 segments + label + checklist).

| Frame                         | Route                                  | State                                                              |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| Sign up default (dark)        | `/signup`                              | strength "Good", checklist, show/hide                              |
| Sign up inline errors (light) | `/signup`                              | per-field errors, strength "Weak", terms error                     |
| Sign in error banner (dark)   | `/signin`                              | `INVALID_CREDENTIALS` banner                                       |
| Sign in loading (light)       | `/signin`                              | button "Signing in…"                                               |
| Sign in rate-limited (dark)   | `/signin`                              | banner + disabled button "Try again in 0:42"; inputs stay editable |
| Sign in offline (light)       | `/signin`                              | offline banner, typed values kept                                  |
| Sign in focus (dark)          | `/signin`                              | focus ring on email                                                |
| Forgot default (light)        | `/forgot-password`                     |                                                                    |
| Forgot sent (dark)            | `/forgot-password`                     | neutral sent state, resend countdown 0:54                          |
| Reset (light)                 | `/reset-password?token=…`              | strength "Strong", match ✓                                         |
| Reset success (dark)          | `/reset-password`                      | "2 sessions ended"                                                 |
| Verify OK (light)             | `/verify-email?token=…`                |                                                                    |
| Verify expired (dark)         | `/verify-email?token=…`                | resend                                                             |
| AR RTL sign-in error          | board shows `/ar/signin` (see Gap G12) |                                                                    |

| Key                                | EN                                                                                                 | AR                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------- |
| auth.backToMarkets                 | Back to markets                                                                                    | [AR]                  |
| auth.valueLine                     | Practice trading US stocks with $100,000 virtual cash                                              | [AR] $100,000         |
| auth.signUp.title                  | Create your account                                                                                | AR —                  |
| auth.field.name / email / password | Name / Email / Password                                                                            | — / [AR]              |
| auth.strength.label                | Strength {Weak\|Good\|Strong}                                                                      | —                     |
| auth.strength.min8                 | At least 8 characters                                                                              | —                     |
| auth.strength.notCommon            | Not a common password                                                                              | —                     |
| auth.strength.tip                  | Tip: add a number or symbol                                                                        | —                     |
| auth.signUp.terms                  | I agree to the Terms and Privacy Policy. I understand prices are simulated and money is virtual.   | —                     |
| auth.signUp.submit                 | Create account                                                                                     | [AR]                  |
| auth.or                            | or                                                                                                 | [AR]                  |
| auth.oauth.google / apple / soon   | Google / Apple / Soon                                                                              | Google / Apple / [AR] |
| auth.signUp.haveAccount            | Already have an account? **Sign in**                                                               | —                     |
| auth.err.nameRequired              | Enter your name                                                                                    | —                     |
| auth.err.emailInvalid              | Enter a full email address, e.g. name@example.com                                                  | —                     |
| auth.err.termsRequired             | Accept the terms to continue                                                                       | —                     |
| auth.signIn.title                  | Welcome back                                                                                       | [AR]                  |
| auth.signIn.forgot                 | Forgot password?                                                                                   | [AR]                  |
| auth.signIn.keep                   | Keep me signed in on this device for 30 days                                                       | [AR]                  |
| auth.signIn.submit / loading       | Sign in / Signing in…                                                                              | [AR] / —              |
| auth.signIn.new                    | New here? **Create an account**                                                                    | [AR]                  |
| auth.signIn.invalidHint            | Check both and try again, or reset your password.                                                  | —                     |
| auth.rateLimited.hint              | For your security we paused sign-in on this account for a minute.                                  | —                     |
| auth.retryIn                       | Try again in {m:ss}                                                                                | —                     |
| auth.offline.signIn                | You’re offline. Reconnect to sign in — we’ll keep what you typed.                                  | —                     |
| auth.forgot.title                  | Reset your password                                                                                | —                     |
| auth.forgot.body                   | Enter the email you signed up with and we’ll send you a reset link.                                | —                     |
| auth.forgot.submit                 | Send reset link                                                                                    | —                     |
| auth.backToSignIn                  | Back to sign in                                                                                    | —                     |
| auth.forgot.sentTitle              | Check your inbox                                                                                   | —                     |
| auth.forgot.sentBody               | If an account exists for {email}, we sent a link to reset your password. It expires in 30 minutes. | —                     |
| auth.forgot.openEmail              | Open email app                                                                                     | —                     |
| auth.forgot.resendIn               | Didn’t get it? Check spam or resend in {m:ss}                                                      | —                     |
| auth.reset.title                   | Choose a new password                                                                              | —                     |
| auth.reset.for                     | For {email}                                                                                        | —                     |
| auth.reset.new / confirm           | New password / Confirm new password                                                                | —                     |
| auth.reset.match                   | Passwords match ✓                                                                                  | —                     |
| auth.reset.warn                    | Saving signs you out on every other device.                                                        | —                     |
| auth.reset.submit                  | Save new password                                                                                  | —                     |
| auth.reset.doneTitle               | Password updated                                                                                   | —                     |
| auth.reset.doneBody                | You’re signed in. Other devices were signed out — {n} sessions ended.                              | —                     |
| auth.reset.goHome                  | Go to Home                                                                                         | —                     |
| auth.reset.notice                  | We also emailed you a security notice.                                                             | —                     |
| auth.verify.okTitle                | Email verified ✓                                                                                   | —                     |
| auth.verify.okBody                 | {email} is confirmed. Your account is secured.                                                     | —                     |
| auth.verify.continue               | Continue trading                                                                                   | —                     |
| auth.verify.expiredTitle           | This link has expired                                                                              | —                     |
| auth.verify.expiredBody            | Verification links work for 24 hours and only once. Send a fresh one to {email}.                   | —                     |
| auth.verify.resend                 | Resend verification email                                                                          | —                     |

### 1.2 M-Auth (mobile full-screen auth)

Native inputs with autofill (`email`, `new-password`). The layout is keyboard-aware, with the primary button pinned above the keyboard, and touch targets are 44 pt. The top bar has a segmented "Sign in | Create account" toggle. Android: Material back arrow, system back closes, Google Password Manager autofill, button sits above the IME.
Proposed routes (no URLs are shown): `(auth)/sign-in`, `(auth)/sign-up`, `(auth)/forgot-password`, `(auth)/reset-password?token=` (deep link).
Frames: sign-up dark/light, sign-in error, sign-in rate-limited, sign-in loading, forgot sent ×2, reset keyboard ×2, reset done, AR RTL sign-in, Android sign-in.

| Key (mobile-specific)           | EN                                                                                | AR   |
| ------------------------------- | --------------------------------------------------------------------------------- | ---- |
| auth.signIn.subtitleMobile      | Sign in to your practice account                                                  | [AR] |
| auth.signIn.forgotShort         | Forgot?                                                                           | [AR] |
| auth.faceId                     | Use Face ID next time · Coming soon                                               | [AR] |
| auth.signUp.termsShort          | I agree to the Terms and understand money is virtual.                             | —    |
| auth.forgot.sentBodyMobile      | If an account exists for {email}, we sent a reset link. It expires in 30 minutes. | —    |
| auth.forgot.openMail / resendIn | Open Mail / Resend in {m:ss}                                                      | —    |
| auth.reset.confirmShort         | Confirm password                                                                  | —    |
| auth.reset.doneBodyMobile       | You’re signed in on this phone. Other devices were signed out.                    | —    |
| auth.reset.continueHome         | Continue to Home                                                                  | —    |

### 1.3 W-Gating (web guest experience)

| Frame                                 | Route                                                     | Notes                                                                                                                                                                                                                         |
| ------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest stock page (dark)               | `/stocks/AAPL`                                            | Ticket fully explorable (Buy/Sell, Market/Limit/Stop, Amount $/Shares, estimates). Buying power row reads "— sign in". Primary CTA is "Sign up to buy AAPL", followed by "Already have an account? Sign in" and the footnote. |
| Auth modal from gated action (light)  | same                                                      | `Dialog` with stock avatar, contextual title, tabs Create account/Sign in, compact form, submit "Create account & continue", footnote about the prefilled order                                                               |
| Guest Portfolio + bell popover (dark) | `/portfolio`                                              | 3-step card; bell `Popover`                                                                                                                                                                                                   |
| Guest empty states (light)            | `/watchlist` (Portfolio, Orders, Watchlist, Alerts cards) | `StateView` variant "invite", never error-styled                                                                                                                                                                              |
| Guest Home (light)                    | `/`                                                       | Hero replaces the equity card, 3 steps, sector heatmap, top movers (Gainers/Losers/Active)                                                                                                                                    |
| Just signed up (dark)                 | `/?welcome=1`                                             | Ready toast + verify banner + checklist (✓ Account created, 2 Verify email, 3 Make first trade)                                                                                                                               |
| Components sheet (dark)               | —                                                         | top bar guest vs signed-in (`PAPER` badge, bell count), toasts, discard warning                                                                                                                                               |
| AR RTL guest stock (light)            | `/ar/stocks/AAPL`                                         |                                                                                                                                                                                                                               |

Top bar (guest): nav Home · Markets · Portfolio · Watchlist · Orders, search ⌘K, market status, **Sign in** (ghost), **Create account** (primary). Signed-in: bell + avatar menu (name, email, `PAPER`).

| Key                           | EN                                                                                                                                                            | AR            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| gate.ticket.cta               | Sign up to buy {SYMBOL}                                                                                                                                       | [AR] {SYMBOL} |
| gate.ticket.haveAccount       | Already have an account? Sign in                                                                                                                              | [AR]          |
| gate.ticket.foot              | Free · $100,000 virtual cash · simulated prices                                                                                                               | [AR]          |
| gate.ticket.buyingPower       | Buying power — sign in                                                                                                                                        | —             |
| gate.title.buy                | Create an account to buy {SYMBOL}                                                                                                                             | [AR] {SYMBOL} |
| gate.title.watch              | Create an account to save {SYMBOL} to your watchlist                                                                                                          | [AR]          |
| gate.title.alert              | Create an account to get price alerts                                                                                                                         | —             |
| gate.title.portfolio          | Create an account to track your portfolio                                                                                                                     | —             |
| gate.title.notifications      | Create an account to get notifications                                                                                                                        | —             |
| gate.modal.sub                | Free · $100,000 practice cash · ready instantly                                                                                                               | —             |
| gate.modal.pwHint             | At least 8 characters · not a common password                                                                                                                 | —             |
| gate.modal.submit             | Create account & continue                                                                                                                                     | —             |
| gate.modal.returnNote         | You’ll land back on this order with {amount} pre-filled.                                                                                                      | —             |
| gate.cta.createFree / signIn  | Create free account / Sign in                                                                                                                                 | [AR]          |
| guest.portfolio.title / body  | Track a $100,000 practice portfolio / Create a free account to buy your first shares, see live P&L and keep it in sync on your phone.                         | —             |
| guest.steps                   | 1 Create an account · Takes 30 seconds · no card, no KYC / 2 Get $100,000 virtual cash · Ready instantly / 3 Trade 22 US stocks · Market, limit & stop orders | —             |
| guest.bell.title / body       | Get notified when it matters / Order fills, price alerts and market news — in one inbox, on every device.                                                     | —             |
| guest.empty.portfolio         | Your portfolio lives here / Sign up to get $100,000 in practice cash and track every position.                                                                | —             |
| guest.empty.orders            | No orders yet / Create an account to place market, limit and stop orders.                                                                                     | —             |
| guest.empty.watchlist         | Save stocks you care about / Star any stock to follow it here — synced on web and phone.                                                                      | —             |
| guest.empty.alerts            | Price alerts need an account / Get notified when {SYMBOL} crosses your price, even with the app closed.                                                       | —             |
| home.guest.badge              | Free · no card needed                                                                                                                                         | —             |
| home.guest.h1                 | Start practicing with $100,000                                                                                                                                | —             |
| home.guest.body               | Trade 22 US stocks with live simulated prices. Learn order types, track P&L and build a watchlist — without risking a cent.                                   | —             |
| home.guest.steps              | Sign up in 30 s / Get $100k virtual cash / Place your first trade                                                                                             | —             |
| home.checklist                | ✓ Account created / Verify your email · Resend link / Make your first trade · Browse markets                                                                  | —             |
| banner.verify                 | Verify your email to secure your account — we sent a link to {email}. **Resend**                                                                              | [AR]          |
| toast.ready.title             | Your $100,000 practice account is ready                                                                                                                       | [AR]          |
| toast.ready.body              | Place your first trade — prices are live and simulated. (Home variant: Welcome, {name}. Prices are live and simulated.) · action **Trade**                    | —             |
| toast.claimed.title / body    | Your practice portfolio was saved / The {positions} positions and {orders} open order from this device are now in your account.                               | —             |
| warn.discard.title            | Signing in will replace this device’s practice data                                                                                                           | —             |
| warn.discard.body             | {positions} positions and {orders} open order on this device will be discarded and your account’s portfolio loaded. They are never merged.                    | —             |
| warn.discard.confirm / cancel | Sign in anyway / Cancel                                                                                                                                       | —             |

### 1.4 M-Gating (mobile guest experience)

Gated actions open one root `AuthGateSheet` (`Sheet`). It contains the stock header, a contextual title, a subtitle, an optional benefits list, **Create free account** (primary) and **Sign in**, with a light haptic on present.
Frames: Buy→sheet (dark), `order/new` as guest (footer "Sign up to buy"), Star→sheet, Home tab guest hero, Account tab guest welcome + App settings (Language, Theme, About & disclosures), AR sheet, Portfolio tab guest, Watchlist tab guest, Create alert→sheet, just-signed-up (toast + verify banner, "Total equity $100,000.00 · New account · no positions yet · Make your first trade"), sign-in with guest data warning, sign-up claimed.

| Key                        | EN                                                                                                                                                                              | AR       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| gate.sheet.buySub          | Free, no card, no KYC — about 30 seconds.                                                                                                                                       | [AR].    |
| gate.sheet.benefits        | $100,000 practice cash, ready instantly / Same account on web and phone / Your ${amount} {SYMBOL} order stays filled in                                                         | [AR] / — |
| gate.sheet.watchSub        | Your watchlist syncs across web and phone.                                                                                                                                      | —        |
| gate.sheet.alertSub        | We’ll notify you when {SYMBOL} crosses your price — even when the app is closed.                                                                                                | —        |
| gate.order.footer          | Create a free account to place this order — you’ll get $100,000 in practice cash.                                                                                               | —        |
| gate.order.buyingPower     | Buying power · Sign in to see                                                                                                                                                   | —        |
| home.guest.bodyMobile      | Trade 22 US stocks with live simulated prices — without risking a cent.                                                                                                         | —        |
| account.guest.title / body | Welcome to Mini Trading / One free account for web and phone: $100,000 practice cash, watchlists, alerts and order history.                                                     | —        |
| account.guest.appSettings  | App settings · Language · Theme · About & disclosures                                                                                                                           | —        |
| guest.portfolio.bodyMobile | Create a free account to buy shares and see live P&L on every device.                                                                                                           | —        |
| warn.discard.titleMobile   | Replace this phone’s practice data?                                                                                                                                             | —        |
| warn.discard.subMobile     | You’re signing in to an existing account.                                                                                                                                       | —        |
| warn.discard.bodyMobile    | On this phone: {positions} positions, {orders} open order and a {n}-stock watchlist. They will be discarded and your account’s portfolio loaded. We never merge two portfolios. | —        |
| toast.claimed.mobile       | Your practice portfolio was saved to your account / {positions} positions and {orders} open order are now on web too.                                                           | —        |
| toast.ready.mobileBody     | Welcome, {name} — place your first trade.                                                                                                                                       | —        |

### 1.5 W-Account (web settings)

Settings uses a left section nav: Profile · Security · Notifications · Appearance · Trading · Danger zone (AR: [AR]).

| Frame                                         | Route                   | State                                  |
| --------------------------------------------- | ----------------------- | -------------------------------------- |
| Profile & Security (dark)                     | `/settings/security`    | sessions list, verified                |
| Unverified + change password expanded (light) | `/settings/security`    | inline "Current password is incorrect" |
| Danger zone + delete dialog (light)           | `/settings/danger`      | password + type DELETE                 |
| Sign out others confirm (dark)                | `/settings/security`    | `Dialog`                               |
| Suspended (dark)                              | `/suspended`            |                                        |
| AR sessions (light)                           | `/ar/settings/security` |                                        |

Profile card: avatar, name, `@handle · member since {date}`, **Edit profile**. Then Email + `Verified`/`Unverified · Resend` badge, Account ID `ACC-7F2K9Q`, and Practice account "$100,000 start · Paper".
Security card: Password "Last changed {n} days ago" + **Change password** (expands inline: Current, New with strength, Confirm, Cancel/Update password). Below it, Active sessions. Each row has a platform icon, device label, a "This device" badge on the current row, `{city}, {CC} · {maskedIp} · {lastActive}`, and a per-row **Sign out** (none on the current row). Last comes the 2FA & passkeys row, marked "Coming soon".

| Key                                           | EN                                                                                                                                                                 | AR                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| settings.profile.memberSince                  | @{handle} · member since {date}                                                                                                                                    | —                                    |
| settings.profile.edit                         | Edit profile                                                                                                                                                       | —                                    |
| settings.email.verified / unverified / resend | Verified / Unverified / Resend                                                                                                                                     | [AR] / — / —                         |
| settings.accountId                            | Account ID                                                                                                                                                         | —                                    |
| settings.practice                             | Practice account · $100,000 start · Paper                                                                                                                          | —                                    |
| settings.password.lastChanged                 | Last changed {n} days ago                                                                                                                                          | —                                    |
| settings.password.change                      | Change password                                                                                                                                                    | —                                    |
| settings.password.current                     | Current password                                                                                                                                                   | —                                    |
| settings.password.wrongCurrent                | Current password is incorrect                                                                                                                                      | —                                    |
| settings.password.newHint                     | Strong · at least 8 characters                                                                                                                                     | —                                    |
| settings.password.warn                        | Changing your password signs out every other device.                                                                                                               | —                                    |
| settings.password.submit                      | Update password                                                                                                                                                    | —                                    |
| settings.sessions.title                       | Active sessions                                                                                                                                                    | [AR]                                 |
| settings.sessions.sub                         | {n} devices · location is approximate (from IP)                                                                                                                    | {n} [AR]                             |
| settings.sessions.signOutOthers               | Sign out of all other devices                                                                                                                                      | [AR]                                 |
| settings.sessions.thisDevice                  | This device                                                                                                                                                        | [AR]                                 |
| settings.sessions.activeNow                   | Active now                                                                                                                                                         | [AR]                                 |
| settings.sessions.signOut                     | Sign out                                                                                                                                                           | [AR]                                 |
| settings.sessions.device                      | {browser} on {os} / Mini Trading for iOS · {model}                                                                                                                 | {browser} [AR] Mini Trading [AR] iOS |
| settings.2fa.title / sub / soon               | Two-factor authentication & passkeys / Authenticator app, passkeys and Face ID unlock / Coming soon                                                                | [AR]                                 |
| settings.signOutOthers.title                  | Sign out of all other devices?                                                                                                                                     | —                                    |
| settings.signOutOthers.body                   | {n} sessions will end within a few seconds: {devices}. Open orders keep working. You stay signed in here.                                                          | —                                    |
| settings.signOutOthers.confirm                | Sign out {n} devices                                                                                                                                               | —                                    |
| danger.title                                  | Danger zone                                                                                                                                                        | [AR]                                 |
| danger.signOut                                | Sign out · Only this browser. Your data stays in your account.                                                                                                     | —                                    |
| danger.reset                                  | Reset practice account · Close all positions, cancel orders, restore $100,000. History is kept. · **Reset…**                                                       | —                                    |
| danger.delete                                 | Delete account · Permanently deletes your profile, practice portfolio, watchlists and alerts after 7 days. · **Delete account…**                                   | —                                    |
| danger.deleteDlg.title                        | Delete your account?                                                                                                                                               | —                                    |
| danger.deleteDlg.body                         | Your practice portfolio ({equity}), {orders} open orders, {watchlists} watchlists and {alerts} alerts will be deleted. You can cancel within 7 days by signing in. | —                                    |
| danger.deleteDlg.type                         | Type DELETE to confirm · Case-sensitive                                                                                                                            | —                                    |
| danger.deleteDlg.confirm                      | Delete account                                                                                                                                                     | —                                    |
| suspended.title                               | Your account is suspended                                                                                                                                          | [AR]                                 |
| suspended.body                                | You’ve been signed out on all devices. Your practice portfolio is kept and nothing was deleted.                                                                    | —                                    |
| suspended.reason                              | Reason from our team “{reason}” · {date}                                                                                                                           | —                                    |
| suspended.contact / signOut                   | Contact support / Sign out                                                                                                                                         | —                                    |
| suspended.ref                                 | Reference {ACC} · You can still browse markets as a guest.                                                                                                         | —                                    |

### 1.6 M-Account (mobile account tab)

Routes (proposed): `(tabs)/account`, `account/security`, `account/change-password`, `account/delete`, `suspended`; root "You were signed out" sheet.
The signed-in Account tab has a profile header (name, email, `Verified`, `@handle · ACC-…`). Rows: Personal info · Security (`{n} devices`) · Notifications · Appearance (Dark) · Trading (Confirm large orders) · Sign out · Delete account (danger). The AR frame also shows a Language row (Gap G27).
Security: Change password ("34 days ago"), "2FA, passkeys & Face ID · Coming soon", Active sessions · {n} (current row "This device", others "Sign out"), "Sign out of all other devices" + "Location is approximate, based on IP." Android frame: Material app bar + ripple.

| Key                                 | EN                                                                                                                                                                             | AR                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| account.rows                        | Personal info / Security / Notifications / Appearance / Trading / Sign out / Delete account                                                                                    | [AR] (+ language) |
| account.securityDevices             | {n} devices                                                                                                                                                                    | {n} [AR]          |
| account.trading.sub                 | Confirm large orders                                                                                                                                                           | —                 |
| account.2faMobile                   | 2FA, passkeys & Face ID · Coming soon                                                                                                                                          | —                 |
| account.sessions.title              | Active sessions · {n}                                                                                                                                                          | —                 |
| account.sessions.approx             | Location is approximate, based on IP.                                                                                                                                          | —                 |
| account.pw.warn                     | Other devices will be signed out.                                                                                                                                              | —                 |
| account.delete.sub                  | This can’t be undone after 7 days.                                                                                                                                             | —                 |
| account.delete.confirm              | Delete my account                                                                                                                                                              | —                 |
| account.signOutOthers.sheet         | Sign out of all other devices? / {n} other sessions are active. / {devices} will be signed out within a few seconds. Open orders keep working. / Sign out {n} devices · Cancel | —                 |
| revoked.title                       | You were signed out                                                                                                                                                            | —                 |
| revoked.body.passwordChanged        | Your session ended because your password was changed on another device ({device}, {time}). If this wasn’t you, reset your password.                                            | —                 |
| revoked.signInAgain / resetPassword | Sign in again / Reset password                                                                                                                                                 | —                 |
| suspended.bodyMobile                | You’ve been signed out on all devices. Your practice portfolio is kept.                                                                                                        | —                 |
| suspended.browseGuest               | Browse as guest                                                                                                                                                                | —                 |

### 1.7 A-Customers (`/customers`)

Admin nav (new order): Overview · Market · Trading · Orders · **Customers** · Stocks · Config · Audit log · **Team** (AR: [AR]). The **Accounts** item is gone (Gap G11).
Frames: ADMIN dark · VIEWER light (masked) · loading skeleton (8 rows) · states (empty search / error / no customers yet) · AR RTL.

- **Header:** "Customers" and the subtitle `{n} registered · customers sign up themselves · admins can’t create customers`. Top right: **Export CSV**.
- **KPI strip** (5 × `StatTile`):

| KPI                  | Value | Delta             |
| -------------------- | ----- | ----------------- |
| Registered customers | 8,412 | ▲ +2.0% this week |
| Signed up today      | 164   | 41% from mobile   |
| Active · 24h         | 3,207 | 38% of registered |
| Suspended            | 37    | 0.4% · 2 today    |
| Verified email       | 86.4% | ▲ +1.1 pt         |

- **Toolbar:**
  - Search, placeholder "Search email, name, handle or ACC-…".
  - `SegmentedControl` All / Active / `Suspended · {n}`.
  - Toggle `Chip`s: Verified, Has open orders.
  - Dev caption "Virtualized · 56 px rows".
- **Columns:**
  - Customer: avatar, name, email.
  - Handle and Status: `Badge` pos "Active" / neg "Suspended".
  - Verified: outline "Verified" / warn "Unverified".
  - Equity (right), All-time P&L (right, `ChangePill`), Open orders (right).
  - Last active, Joined.
  - A row-actions `IconButton` labelled "Actions for {name}".
- **VIEWER:**
  - `Banner`: "View-only access. You can see customers but not change them. Emails are masked for VIEWER — **why?**"
  - Emails show as `s•••@example.com` (first char + `•••@domain`). Name and handle are not masked.
- **States:**
  - Empty search: "No customers match “{q}”" / "Search covers email, name, handle and account ID. Filters: {active filters}." / **Clear filters**.
  - Error: "Couldn't load customers" / "The admin API returned an error. Nothing was changed." / `{status} · GET /admin/customers · {requestId}` / **Retry**.
  - Zero: "No customers yet" / "Customers create their own accounts from web or mobile — admins never create them. Share the app link to get your first sign-up." / **Copy app link**.
- **AR keys:**
  - Header: h1 [AR] · sub `8,412 [AR]` · export [AR] CSV.
  - Search placeholder: [AR].
  - Segments: [AR] · 37 · chips [AR].
  - Columns: [AR].
  - Status: [AR].
  - KPIs: [AR], with deltas "▲ +2.0% [AR]".

Keys: `admin.customers.{title,sub,export,searchPh,seg.*,filter.*,col.*,kpi.*,empty.*,error.*,zero.*,viewerBanner,rowActions}`.

### 1.8 A-CustomerDetail (`/customers/ACC-7F2K9Q`)

Frames: Overview + actions (dark) · Suspend dialog (light) · Sessions tab (dark) · Reset dialog (light) · Activity tab (dark) · VIEWER (light).

- **Breadcrumb:** Customers › {name}.
- **Header:** avatar, name, status badge, "Email verified", email, `@handle`, `ACC-…`, "Joined {date}", "Last active {rel} · {device}".
- **Tabs:** Overview · `Orders · {n} open` · `Sessions / devices · {n}` · Activity.
- **Overview tab:**
  - KPIs: Equity ({dayPl} today), Cash ({reserved} reserved), All-time P&L ({pct}), Positions ({n} open orders).
  - Positions table: Position · Shares · Avg cost · Market value · Total return.
- **Orders tab:** no frame. Reuse the admin Orders table filtered by customer.
- **Sessions tab:**
  - Rows: icon, device, `{city}, {CC} · {ip x.x} · active {rel}`, "Since {date}".
  - Note: "Sessions are per device. Revoking ends them within ~2 s via `session.revoked`; the customer sees “You were signed out”."
- **Activity tab:**
  - Columns: Time · Actor (`customer` / `{email}@ (admin)`) · Action chip · Detail.
  - Chips: `order.filled`(pos), `order.placed`(brand), `customer.reset_password_sent`(info), `session.created`(neutral), `alert.created`(brand), `email.verified`(pos), `customer.signup`(pos, e.g. "Web · claimed device portfolio (2 positions)").
- **Admin actions panel** (each action has a tooltip):
  - Active customer: **Suspend customer…** (danger, "Signs out all devices"). Suspended customer: **Reactivate customer** (primary, "Restores sign-in; customer is notified").
  - **Sign out all devices…** ("Revokes every session").
  - **Send password reset email** ("Customer sets a new password themselves").
  - **Reset practice account…** ("Restore $100,000").
  - Footer: "Admins can’t view passwords, trade for, or edit a customer’s balance. Every action needs a reason and is audited."
- **Suspend dialog:**
  - Title: "Suspend {name}?"
  - Body: "She’ll be signed out on {n} devices within seconds and see “Your account is suspended”. Open orders are canceled; the portfolio is kept."
  - Fields: **Reason category** select (sample "Abuse · automated trading scripts") and **Reason (shown to the customer)** textarea, hint "Required · 10–280 characters · stored in the audit log".
  - Buttons: Cancel / **Suspend customer** (danger).
- **Reset dialog:**
  - Title: "Reset practice account?"
  - Body: "Closes {n} positions at last price, cancels {m} open orders and restores **$100,000.00**. Order history and audit trail are kept. The customer is notified."
  - Compare: "Equity now {x}" → "After reset $100,000.00".
  - Fields: Reason, then "Type RESET {ACC} to confirm".
  - Buttons: Cancel / **Reset account**.
- **VIEWER:**
  - Banner: "View-only access. Actions are disabled for VIEWER. Email is masked."
  - Actions are disabled with a lock and the tooltip "Viewers can't make changes". Email shows as `s•••@example.com`.
- **What the admin can't do:** see passwords, trade for a customer, edit balances, or create customers.

### 1.9 A-Users → Team (`/team`)

- **Header:**
  - Title "Team". Subtitle: "Admin staff only · {n} accounts · {a} ADMIN · {v} VIEWER · customers live in Customers".
  - **Invite admin** button. Segments: All / Active / Disabled.
- **Columns:** User (avatar, name, "You" badge, email) · Role (select, with option descriptions "ADMIN — Full control: market, stocks, config, users." / "VIEWER — Read-only. Sees everything, changes nothing.") · Status · Last active · **2FA** (`On` pos / `Off` warn) · Actions (Disable / Re-enable).
- **Own row:** locked. Footer: "You can't change your own role or disable yourself. At least one ADMIN must remain active. Role changes take effect on the user's next request and are audited as `user.role`."
- **Invite dialog:**
  - Title "Invite admin", body "They'll get an email link valid for 48 hours."
  - Work email, with error "Enter a full email address, e.g. sam@minitrading.dev".
  - Role radio: ADMIN "Full control" / VIEWER "Read-only access".
  - Buttons: Cancel / **Send invite**.

### 1.10 A-Overview, A-Audit, A-Viewer

- **Overview** (`/overview`):
  - Five KPIs: Connected clients 1,284 (▲ +8.2% vs 1 h ago) · Active subscriptions 9,412 (symbol streams) · **Registered customers 8,412 (▲ +164 signed up today)** · **Guest visitors · 24h 2,930 (6.1% converted to sign-up)** · Watchlisted items 6,730 (▼ −0.4% vs yesterday).
  - "Top watchlisted stocks", subtitle "Users with the stock starred · all clients", tabs Now/7d/30d.
  - Auto-refresh every 10 s, paused while the tab is hidden.
- **Audit** (`/audit`):
  - Subtitle "Every admin action, immutable · {n} events · retained 400 days".
  - Filter chips: `customer.*` (wildcard group) · `account.reset` · `market.pause`.
  - New action chips: `customer.suspend` (neg), `customer.signout_all` (warn, actor `system`, payload `{sessionsRevoked, trigger}`), `customer.reset_password_sent` (info), `account.reset` (brand, `{equityBefore, equityAfter}`).
  - Entity format: `Customer · ACC-XXXXXX`. Expanded payload includes `ip`, which is masked for VIEWER.
- **Viewer** (`/market`, 403):
  - Unchanged pattern: keep controls visible, disable them, add a lock glyph and a tooltip.
  - The 403 frame still says "You don't have access to Users" at `/users` (Gap G10).
  - "What VIEWERs can do" still lists "Filter, sort and export the audit log".

---

## 2. Flows (X-AccountFlows)

**F1 Gated action → auth → back to action**

1. A guest taps a personal action (Buy/Sell, ☆, Create alert, Portfolio/Orders tab, Notifications), or any personal endpoint returns 401.
2. `useRequireAuth(intent).run()` saves `{action, symbol, side, type, amount|qty, condition}` with a timestamp. On web it goes to memory + `sessionStorage`; on mobile to memory/route params. TTL is 10 min.
3. Web opens the auth `Dialog`; mobile opens the `AuthGateSheet`. The contextual title comes from the table below, with Sign up ↔ Sign in tabs.
4. `POST /auth/sign-up` or `/auth/sign-in` → session created (access + refresh). Same account on web and phone.
5. Replay the intent if it is younger than 10 min. **Orders are never auto-submitted.**

| Intent           | After auth                                                            |
| ---------------- | --------------------------------------------------------------------- |
| Buy/Sell         | Ticket reopens with side, type, amount pre-filled; still needs review |
| ☆                | Star applied, toast "Saved to Watchlist"                              |
| Create alert     | Alert form reopens with condition kept                                |
| Portfolio/Orders | Land on tab; new account shows "Make your first trade"                |
| Notifications    | Inbox opens with the welcome notification                             |

**F2 Sign up → instant account → verify**

1. Sign up with name, email, password (≥ 8, not common) and terms.
2. The account and a $100k paper account are created at once (no KYC). Toast: "Your $100,000 practice account is ready".
3. The verify banner shows ("Verify your email to secure your account · Resend").
4. The email link (single-use, 24 h) goes to `/verify-email?token` → `POST /auth/verify`. On success the banner is removed and the badge reads "Verified". Verification **never blocks** trading.

**F3 Forgot → reset → other sessions revoked**

1. Enter an email → `POST /auth/forgot` → always the same neutral response.
2. The email is sent only if the account exists. The link is single-use and lasts 30 min.
3. `/reset-password?token` → new password + confirm + strength meter → `POST /auth/reset`.
4. Server: set the hash, revoke **all other** sessions (push `session.revoked` reason `password_reset`), create the current session, and send a security-notice email.
5. UI: "Password updated · {n} sessions ended".

**F4 Device with guest data (claim vs discard)**

1. The device holds an anonymous account id (web cookie / mobile SecureStore) with data such as 3 positions, 1 open order and a watchlist of 7.
2. **Sign up:** the server re-parents the anonymous account to the new user in one transaction. Toast "Your practice portfolio was saved". Audit `customer.signup` with `claimed`.
3. **Sign in:** the credentials are checked first, then the server answers "guest data present" with counts → the replace warning shows → **Sign in anyway** confirms → the server deletes the guest data and loads the account. **Cancel** keeps the guest state.
4. The two portfolios are never merged.

**F5 Admin suspends a customer**

1. Admin: Suspend → confirm dialog with category + reason (10–280 characters).
2. Audit `customer.suspend` (actor, reason, before/after status), then `customer.signout_all` (actor `system`, trigger).
3. Open orders are canceled (per the dialog copy, see G5). Refresh tokens/session rows are deleted, and `session.revoked {reason:'suspended'}` is pushed on `user:{id}`. The `user:` room is disconnected.
4. Web and phone sign out within about 2 s → route to `/suspended` with the reason, date, Contact support and reference ACC id.

**F6 Customer session events:**

- "Sign out of all other devices" → confirm → `POST /auth/sessions/revoke-others` → the other devices get `session.revoked` and the "You were signed out" sheet. Open orders keep working.
- Change password works the same way, with reason `password_changed`.

---

## 3. Dev-AuthNotes (normalized requirements)

**Focus order:**

1. Skip link → logo → "Back to markets".
2. First field. Autofocus on desktop only, never on mobile.
3. Fields in visual order. Show/hide is its own tab stop with `aria-pressed`.
4. Terms checkbox → primary button → Google/Apple. These stay focusable with `aria-disabled` so "coming soon" is announced.
5. Secondary link.

Gating modal/sheet: focus moves to the title and is trapped inside. Esc, swipe-down or back closes it and returns focus to the trigger. On error: focus the top `role="alert"` banner. Each invalid field gets `aria-invalid` + `aria-describedby`.

**Error codes:**

| Code                | EN                                                          | AR           |
| ------------------- | ----------------------------------------------------------- | ------------ |
| INVALID_CREDENTIALS | Email or password is incorrect.                             | [AR].        |
| RATE_LIMITED        | Too many attempts — try again in {m:ss}.                    | [AR] {m:ss}. |
| EMAIL_IN_USE        | An account with this email already exists. Sign in instead? | [AR]         |
| WEAK_PASSWORD       | This password is too common — try a longer phrase.          | [AR].        |
| TOKEN_EXPIRED       | This link has expired. We can send a new one.               | [AR].        |
| ACCOUNT_SUSPENDED   | Your account is suspended.                                  | [AR].        |
| SESSION_REVOKED     | You were signed out on this device.                         | [AR].        |
| OFFLINE (client)    | You’re offline. Reconnect to continue.                      | [AR].        |

Keys: `auth.errors.<CODE>`. The design also needs `INVALID_CURRENT_PASSWORD` ("Current password is incorrect") and `CONFIRMATION_MISMATCH` (DELETE / RESET text), which are not in the table.

**Rate limits:**

| Action        | Limit                                          |
| ------------- | ---------------------------------------------- |
| Sign-in       | 5 failures / 15 min per account **and** per IP |
| Forgot        | 3 / hour per email                             |
| Sign-up       | 10 / hour per IP                               |
| Resend verify | 1 / 60 s                                       |

The server returns `429` + `Retry-After` (seconds) + code `RATE_LIMITED`. The UI counts m:ss down locally. The button reads "Try again in 0:42" and is disabled; inputs stay editable. The banner is `role="alert"` once. The countdown is not a live region. At 0:00, a polite "You can try again now" (key `auth.retryReady`, AR —). Forgot and sign-in copy never reveal whether an email exists.

**Motion (existing motion tokens):**

| Element                           | Enter                                                      | Exit                                              | Reduced motion        |
| --------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- | --------------------- |
| Dialog (web auth modal, confirms) | scrim fade 200 ms; scale .96→1 + fade 320 ms ease-standard | 200 ms ease-exit                                  | fade 120 ms, no scale |
| Mobile gating sheet               | slide up 320 ms ease-standard + light haptic               | follows the finger; release > 30% closes (200 ms) | fade 120 ms           |
| Toast "account ready"             | slide 16 px + fade 320 ms                                  | auto after 5 s; 200 ms ease-exit                  | fade only             |
| Strength meter                    | segment fill 200 ms                                        | —                                                 | instant               |
| Session revoked                   | sheet 320 ms after `session.revoked`                       | —                                                 | fade 120 ms           |

**A11y labels** (`a11y.*`):

| Control              | Label                                                  |
| -------------------- | ------------------------------------------------------ |
| Show/hide password   | "Show password" / "Hide password" + `aria-pressed`     |
| Close                | "Close" (returns focus)                                |
| Dismiss              | "Dismiss verify-email message"                         |
| Guest bell           | "Notifications — sign in to see yours"                 |
| Per-session sign out | "Sign out {device}, {city}"                            |
| Admin row actions    | "Actions for {name}"                                   |
| Google/Apple         | "Continue with Google — coming soon" (`aria-disabled`) |
| Guest star           | "Add {SYMBOL} to watchlist — requires an account"      |

**Security & session model:**

- **Passwords:** argon2id. ≥ 8 chars plus a breached/common-password check. Never logged; admins can't read them.
- **Access token:** 15 min.
- **Refresh token:** rotating. Lasts **30 days** with "Keep me signed in", **1 day** without.
- **Web:** HttpOnly Secure SameSite=Lax cookies **+ CSRF token**.
- **Mobile:** refresh token in SecureStore/Keychain.
- **Revocation:** each session is a DB row. Suspend, password change/reset and "sign out all" delete the rows and push `session.revoked` on the user's WS channel.
- **Links:** reset tokens are single-use and last 30 min. Verify tokens last 24 h. Both are hashed at rest.
- **Guest:** data lives under an anonymous account id (device cookie / SecureStore). Sign-up re-parents it; sign-in deletes it server-side after confirmation. Never merge.
- **Gating:** every personal endpoint returns 401 for guests. The client maps a 401 on a gated action to the auth sheet and stores the intent (10 min).

---

## 4. Admin summary

- **Customers:**
  - KPIs: registered, signed up today + mobile share, active 24h, suspended + today, verified %.
  - Filters: status segment, Verified, Has open orders.
  - Search: email, name, handle, `ACC-` id.
  - Columns as in §1.7. Rows are virtualized at 56 px with cursor pagination.
  - Export CSV is ADMIN-only and audited (G7).
  - VIEWER gets masking **option B** (masked emails, server-side `PiiPolicy`).
- **CustomerDetail:**
  - 4 tabs.
  - 4 actions. Each needs a confirm dialog and a **required reason** (suspend also needs a category; reset also needs typed `RESET ACC-…`).
  - Reactivate is a non-danger action that still needs a reason.
  - No reveal-PII control is designed (G6).
  - Admins cannot see passwords, trade, edit balances or create customers.
- **Team:** rename Users → Team (`/team`, redirect `/users`). Invite by email link (48 h). 2FA column (G9). Own row locked. At least one active ADMIN must remain.
- **Overview:** add Registered customers and Guest visitors · 24h (with conversion %). Top watchlisted is "users with the stock starred".
- **Audit:** new actions and a `customer.*` group filter. Retained 400 days.

---

## 5. Backend/API contract implied by the design

Customer auth uses `aud:'customer'`. All responses use contracts in `@sarwa/contracts` (zod).

| Endpoint                            | Request                                                 | Response / notes                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/sign-up`                | name, email, password, acceptTerms:true, keepSignedIn   | 201 `{user, accessToken?(mobile), claimed?:{positions, openOrders, watchlist}}`; 409 EMAIL_IN_USE, 400 WEAK_PASSWORD, 429                                                           |
| `POST /auth/sign-in`                | email, password, keepSignedIn, `confirmDiscard?:ticket` | 200 session; 401 INVALID_CREDENTIALS; 403 ACCOUNT_SUSPENDED `{reason, at, publicId}`; 409 `GUEST_DATA_PRESENT {positions, openOrders, watchlist, ticket(2 min)}`; 429 + Retry-After |
| `POST /auth/refresh`                | cookie / body token                                     | rotates; reuse revokes the family                                                                                                                                                   |
| `POST /auth/sign-out`               | —                                                       | current session                                                                                                                                                                     |
| `GET /auth/sessions`                | —                                                       | `[{id, label, platform:'web'\|'ios'\|'android', browser?, os?, model?, city?, country?, ipMasked, lastActiveAt, createdAt, current}]`                                               |
| `DELETE /auth/sessions/:id`         | —                                                       | not allowed for the current session                                                                                                                                                 |
| `POST /auth/sessions/revoke-others` | —                                                       | `{revoked:n, labels[]}`                                                                                                                                                             |
| `POST /auth/forgot`                 | email                                                   | 202 always (rate-limited)                                                                                                                                                           |
| `GET /auth/reset/:token`            | —                                                       | `{email}` or 410 TOKEN_EXPIRED                                                                                                                                                      |
| `POST /auth/reset`                  | token, password                                         | `{sessionsRevoked:n}` + new session                                                                                                                                                 |
| `POST /auth/verify`                 | token                                                   | `{email}`; 410 TOKEN_EXPIRED                                                                                                                                                        |
| `POST /auth/verify/resend`          | —                                                       | 202; 1/60 s                                                                                                                                                                         |
| `GET /me`                           | —                                                       | `{id, publicId:'ACC-XXXXXX', name, handle, email, emailVerified, createdAt, passwordChangedAt, status}`                                                                             |
| `PATCH /me`                         | name, handle                                            | Edit profile                                                                                                                                                                        |
| `POST /me/password`                 | currentPassword, newPassword                            | `{sessionsRevoked}`; 400 INVALID_CURRENT_PASSWORD                                                                                                                                   |
| `GET /me/summary`                   | —                                                       | `{equity, openOrders, watchlists, alerts}` (delete dialog)                                                                                                                          |
| `POST /me/account/reset`            | confirm                                                 | customer self-reset (danger zone)                                                                                                                                                   |
| `POST /me/delete`                   | password, confirm:'DELETE'                              | 202 `{purgeAt}`; signing in during the 7-day grace cancels                                                                                                                          |

**Admin**

| Endpoint                                                            | Notes                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/customers?q&status&verified&hasOpenOrders&cursor&limit` | rows `{publicId, name, email*, handle, status, emailVerified, equity, allTimePl, openOrders, lastActiveAt, createdAt}`, `total`, `nextCursor`. `q` matches email/name/handle/publicId. *masked for VIEWER |
| `GET /admin/customers/kpis`                                         | `{registered, registeredWeekPct, signedUpToday, signedUpTodayMobilePct, active24h, suspended, suspendedToday, verifiedPct, verifiedPctDeltaPt}`                                                           |
| `GET /admin/customers/export.csv`                                   | ADMIN only, audited `customer.export`                                                                                                                                                                     |
| `GET /admin/customers/:publicId`                                    | header `{…row, lastActiveDevice, suspension?:{category, reason, at}}`, kpis `{equity, dayPl, cash, reserved, allTimePl, allTimePct, positions, openOrders}`, positions                                    |
| `GET …/:id/orders`, `…/:id/sessions`, `…/:id/activity`              | sessions as the customer shape plus `since`; activity is audit + domain events for the customer                                                                                                           |
| `POST …/:id/suspend`                                                | `{category, reason(10–280)}`                                                                                                                                                                              |
| `POST …/:id/reactivate`                                             | `{reason}`                                                                                                                                                                                                |
| `POST …/:id/sign-out-all`                                           | `{reason}`                                                                                                                                                                                                |
| `POST …/:id/password-reset`                                         | `{reason}`                                                                                                                                                                                                |
| `POST …/:id/reset-account`                                          | `{reason, confirm:'RESET ACC-…'}`                                                                                                                                                                         |
| `POST …/:id/reveal`                                                 | ADMIN, audited `customer.pii_viewed` (G6)                                                                                                                                                                 |
| `POST /admin/invites`                                               | `{email, role}`; `POST /admin/invites/accept {token, name, password}` (48 h, single-use, hashed)                                                                                                          |
| `GET /admin/overview`                                               | adds `registeredCustomers, signedUpToday, guestVisitors24h, guestConversionPct`                                                                                                                           |

**WS:**

- `session.revoked {sessionId|'all', reason:'suspended'|'password_changed'|'password_reset'|'signout_others'|'session_signout'|'admin_signout', byLabel?, at, suspension?}` on `user:{id}`.
- The client shows the "You were signed out" sheet, or routes to `/suspended`.

**Audit actions to add:** `customer.signup`, `customer.suspend`, `customer.reactivate`, `customer.signout_all`, `customer.reset_password_sent`, `customer.pii_viewed`, `customer.export`, `user.invite`. Keep `account.reset`.

**Customer activity event names (detail tab):** `order.placed`, `order.filled`, `session.created`, `alert.created`, `email.verified`.

**Data model additions beyond plan:**

- `User`: `publicId`, `handle` (unique), `passwordChangedAt`, `deletionRequestedAt`, `signupPlatform`, `suspension{category, reason, at}`.
- `Session`: `label`, `platform`, `city`, `country`, `keepSignedIn`.
- New `AdminInvite` table.

---

## 6. Gaps / conflicts (with recommended resolutions)

| #   | Issue                                                                                                                                                                            | Recommendation                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | **Hashing**: the plan says bcrypt cost 12 and admins use bcryptjs; the design says argon2id.                                                                                     | Customers use argon2id (`@node-rs/argon2`). Admins: verify bcrypt and re-hash to argon2id on the next login. One `PasswordHasher` with the hash prefix telling the two apart.                                |
| G2  | **Refresh TTL** is not in the plan; the design says 30 d with keep-me-signed-in, 1 d without.                                                                                    | Adopt the design and store `keepSignedIn` on the session.                                                                                                                                                    |
| G3  | **CSRF**: the plan says SameSite=Lax + Origin check; the design adds a CSRF token.                                                                                               | Keep the Origin check and add a double-submit CSRF token (readable cookie + `X-CSRF-Token` header) on cookie-authenticated mutations.                                                                        |
| G4  | **Guest identity**: the plan uses `Account.deviceId`; the design uses an "anonymous account id in cookie/SecureStore".                                                           | The same thing: the existing device-scoped paper account _is_ the anonymous account. The claim sets `userId`; discard deletes it.                                                                            |
| G5  | **Suspend + open orders**: the plan leaves a choice (cancel or keep); the suspend dialog says "Open orders are canceled".                                                        | Cancel them, with `cancelReason:'ACCOUNT_SUSPENDED'` and shared order copy. No toggle.                                                                                                                       |
| G6  | **PII reveal**: Q3 wants an ADMIN reveal audited as `customer.pii_viewed`; the design has no reveal control, ADMIN sees full emails, and session IPs show as `x.x` for everyone. | ADMIN sees full emails (design). IPs are masked for every role by default. The Sessions tab gets an ADMIN-only "Show full IPs" button → `POST …/reveal` (audited).                                           |
| G7  | **Export CSV** is drawn in the VIEWER frame; Q3 says customer exports are ADMIN-only.                                                                                            | For VIEWER, show the button disabled with a lock and tooltip (the A-Viewer "never hide" pattern). Audit export stays allowed for VIEWER, masked.                                                             |
| G8  | **Team invite** flow vs today's create-user-with-password (`POST /admin/users`). The accept page is not designed.                                                                | Replace creation with `AdminInvite` (hashed token, 48 h, single-use, `user.invite` audit). The accept page reuses the admin login card: name + password. Mailer = LogMailer in dev.                          |
| G9  | **2FA column** shows On/Off, but 2FA is "coming soon" everywhere.                                                                                                                | Drop the column until admin 2FA exists. Don't show fake data.                                                                                                                                                |
| G10 | **A-Viewer** still shows `/users` and "You don't have access to Users".                                                                                                          | Rename the copy to Team, use the `/team` route, redirect `/users` → `/team`.                                                                                                                                 |
| G11 | **Admin "Accounts" page** is gone from the design nav.                                                                                                                           | Merge into Customers: account reset moves to the customer detail, and `/accounts` redirects to `/customers`. Guest (device-only) accounts only show up in the Guest visitors KPI.                            |
| G12 | **AR URLs** (`/ar/signin`, `/ar/stocks/AAPL`) conflict with the decision that locale-in-URL comes later.                                                                         | Keep the cookie locale now and ignore the `/ar` prefix.                                                                                                                                                      |
| G13 | **Settings routes**: Profile and Security both live on `/settings/security`, the other sections have no frames, and web has a single `/settings` today.                          | `/settings/[section]`. Profile + Security render together on `security` (the `profile` nav item anchors there). Notifications/Appearance/Trading wrap the existing settings content. Danger is its own page. |
| G14 | **Handle** (`@sara.trades`) is shown, but sign-up doesn't ask for one; Edit profile and Personal info are not designed.                                                          | Auto-generate the handle from the name plus a suffix (unique). Edit profile = a dialog with name + handle.                                                                                                   |
| G15 | **Account ID** `ACC-XXXXXX` is not in the model.                                                                                                                                 | `publicId`: 6-character Crockford base32, unique, used in admin URLs and search.                                                                                                                             |
| G16 | **Delete with a 7-day grace** is not in the plan.                                                                                                                                | `deletionRequestedAt` plus a daily purge job. Signing in within 7 days cancels it (show a toast; copy needed). Revoke all sessions on request.                                                               |
| G17 | **Customer self-reset** (Danger zone "Reset…") is not in the plan, and its dialog isn't designed.                                                                                | Reuse the admin reset dialog layout with typed `RESET`. Audit `account.reset` with actor customer.                                                                                                           |
| G18 | **Location / device labels** (city, country, "iPhone 15", "Chrome on macOS") have no source.                                                                                     | Offline GeoIP (`geoip-lite`) at session creation, `ua-parser-js` on web, `expo-device` model name sent by mobile at sign-in.                                                                                 |
| G19 | **IP mask format**: the design uses `41.32.x.x`; Q3 uses `192.168.•.•`.                                                                                                          | One `maskIp` that keeps 2 octets and uses `•`, matching `maskEmail`. The design's `x` is illustrative.                                                                                                       |
| G20 | **Lockout**: the plan says per-email backoff; the design says a fixed 5/15 min, but the copy says "paused … for a minute".                                                       | Use fixed windows + Retry-After. Change the hint copy to "For your security we paused sign-in on this account for a few minutes." (or render the actual minutes).                                            |
| G21 | **Sign-in discard confirmation** needs a post-credential step.                                                                                                                   | `409 GUEST_DATA_PRESENT` + a short-lived ticket. Confirming resubmits with the ticket; Cancel keeps the guest state.                                                                                         |
| G22 | **Suspended screen** needs the reason with no session.                                                                                                                           | Return `suspension{reason, at, publicId}` in the 403 `ACCOUNT_SUSPENDED` body and in the `session.revoked` payload. Keep it in memory for `/suspended`.                                                      |
| G23 | **Suspend reason categories** are not enumerated.                                                                                                                                | Abuse · automated trading scripts / Fraud or suspicious activity / Terms violation / Customer request / Other.                                                                                               |
| G24 | **Guest visitors · 24h + conversion** needs guest tracking.                                                                                                                      | Count distinct anonymous accounts active in 24 h. Conversion = sign-ups in 24 h ÷ guests in 24 h.                                                                                                            |
| G25 | "Signed up today · 41% from mobile"                                                                                                                                              | Store `signupPlatform` from the client header.                                                                                                                                                               |
| G26 | **Welcome notification** after Notifications gate / sign-up                                                                                                                      | Create one inbox notification on sign-up.                                                                                                                                                                    |
| G27 | **Mobile Account rows**: the AR frame has a Language row, EN doesn't; the guest tab has Language.                                                                                | Show Language for signed-in users in both locales.                                                                                                                                                           |
| G28 | **Copy variants**: three terms strings (page / modal / mobile) and two forgot-sent bodies.                                                                                       | Keep separate keys as listed. Translate every "AR —" before merge.                                                                                                                                           |
| G29 | **Verify resend vs forgot resend**: the forgot sent-state shows a 0:54 countdown, but the limits table only defines 3/h for forgot.                                              | Client-side 60 s resend cooldown for both; the server keeps 3/h per email for forgot.                                                                                                                        |
| G30 | **Audit retention** of 400 days vs Q3's IP retention window.                                                                                                                     | Keep events 400 d and anonymize `ip`/UA after 90 d (job). Document it in the ADR.                                                                                                                            |
