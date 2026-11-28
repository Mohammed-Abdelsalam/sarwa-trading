# Claude Design brief — Customer accounts, sign-in & feature gating

> Repo copy: the Arabic column of the copy table is replaced by `[AR]`. The shipped Arabic strings live in `packages/i18n`.

Work inside my existing canvas **"Mini Trading — UI kit"**. It is the source of truth: reuse its tokens (iris `#5457E8`, Inter / Manrope / JetBrains Mono, lucide icons), the components on **DS-Components** and **DS-Trading**, and the layout of the existing **W-\*** (web), **M-\*** (mobile) and **A-\*** (admin) boards. Don't invent new colors, radii or type styles. Add the new boards listed below next to the existing ones, with the same naming scheme. Every screen must come in **dark (hero) and light**, and one **Arabic RTL** variant per board (IBM Plex Sans Arabic, mirrored layout, Latin digits by default).

## Product context (why this is changing)

Mini Trading is a paper-trading app: 22 simulated US stocks with live prices, a $100,000 virtual account, market/limit/stop orders, portfolio, watchlist, alerts and notifications. It has web, mobile and an admin dashboard.

Today there is no customer login, so each browser or phone gets its own anonymous account. Web and mobile don't share data, and clearing the browser loses everything. We're moving to the model real brokers use (Robinhood, eToro, Trading 212):

- **Guests can browse the market freely.** That means Markets, search, stock pages, live prices and charts. The order ticket is visible but can't be submitted.
- **An account is required the moment the user wants something personal.**
  - Placing an order, opening Portfolio or Orders, starring a stock, creating an alert, and the notification inbox.
  - Each of these opens a contextual sign-up prompt, and after auth the user lands back on the same action.
- **One account, every device.** Sign in on web and phone and you see the same cash, positions, orders, watchlist and alerts, updating live.
- **Sign-up is self-service and instant.** The $100k practice account is created right away with no KYC. Email verification is requested but doesn't block practice trading.
- **Customers create their own accounts. The admin never does.** The admin can find a customer and see their practice account, suspend or reactivate them (with a reason), sign them out of all devices, send a password-reset email and reset the practice account. Everything is audited. The admin can't see or set passwords, can't trade for a customer and can't edit balances. A VIEWER admin sees everything read-only.
- **Existing anonymous data:**
  - If someone with an existing practice portfolio on this device **signs up**, that portfolio becomes their account's portfolio. Show a "Your practice portfolio was saved to your account" confirmation.
  - If they **sign in** to an existing account, the device's anonymous practice data is discarded after an explicit notice. Never merge two portfolios.

**Auth methods.** Build email + password now: sign up, sign in, forgot password via an email link, reset, and verify email. Show "Continue with Google / Apple" as **disabled "Coming soon"** buttons so the layout already has room for them. Passkeys, 2FA and Face ID unlock are later phases; they get one placeholder row in Security settings.

## Boards to add

### X-AccountFlows — the flows as diagrams (one board)

1. Guest browsing → gated action → auth sheet → back to the action, completed. Show it for Buy, Star, Create alert and Portfolio tab.
2. Sign up → instant $100k practice account → verify-email banner → email link → verified.
3. Forgot password → email → reset → all other sessions signed out.
4. A device with existing anonymous data: the sign-up path (data kept) vs the sign-in path (data discarded, with a warning).
5. An admin suspends a customer → that customer's web and phone are signed out live → they see the Suspended screen.

### W-Auth — web auth pages

These are centered auth cards on the app shell background, with the logo and a short value line: "Practice trading US stocks with $100,000 virtual cash".

- **Sign up.** Fields: Name, Email, Password (strength meter, show/hide, rules: at least 8 characters, not a common password). A terms checkbox. A primary "Create account" button, disabled Google/Apple buttons, and a "Already have an account? Sign in" link.
- **Sign in.** Fields: Email and Password. Also a "Keep me signed in" option, a "Forgot password?" link and a "New here? Create an account" link.
- **Forgot password:** enter email → "If an account exists, we sent a link" (neutral wording that never reveals whether the email exists).
- **Reset password** (opened from the link): new password plus confirm → success → "You're signed in. Other devices were signed out."
- **Verify email:** the landing page for "Email verified ✓" and for "Link expired → Resend".
- **States for every page:** default, focus, inline field errors, a top error banner ("Email or password is incorrect"), loading button, rate-limited ("Too many attempts — try again in 0:42"), and offline.

### W-Gating — web gating states

- **Order panel on a stock page as a guest.** The ticket is fully explorable: side, type, amount, estimate. The primary button reads **"Sign up to buy AAPL"**, and under it: "Already have an account? Sign in".
- **Auth modal (dialog)** opened by a gated action. Its title gives the context: "Create an account to buy AAPL", "…to save AAPL to your watchlist", "…to get price alerts". It holds the sign-up form, with a switch to sign in. Show it compact enough to sit over the stock page.
- **Guest views of personal areas:**
  - Portfolio, Orders, Watchlist and Alerts as guest: each gets a friendly empty state with an illustration, one line of value and a "Create free account" + "Sign in" pair. No error look.
  - Bell / notifications: a guest version of the popover.
- **Top bar:**
  - As a guest: the PAPER chip is replaced by "Sign in" (ghost) and "Create account" (primary).
  - Signed in: avatar, name, email, PAPER chip.
- **Guest home.** The hero swaps the equity card for "Start practicing with $100,000", CTAs and a 3-step explainer. Top movers and the sector heatmap stay.
- **Post-sign-up toast or banner:**
  - "Your $100,000 practice account is ready".
  - "Your practice portfolio from this device was saved to your account" (claim case).
  - A warning variant for the sign-in discard case: "Signing in will replace this device's practice data (3 positions, 1 open order) with your account's." with a "Sign in anyway" button.
- **Verify-email banner** (dismissible, info tone) under the top bar: "Verify your email to secure your account · Resend".

### W-Account — web account and security

Show this as a Settings page, extending the existing settings layout.

- **Profile:** name, email with a "Verified" or "Unverified · Resend" badge, account handle, and member since.
- **Security:**
  - Change password, which needs the current password.
  - **Active sessions** list: device or browser, platform icon, approximate location or IP, last active, "This device" tag, per-row "Sign out", and "Sign out of all other devices".
  - A 2FA row marked "Coming soon".
- **Danger zone:** Sign out, and Delete account. Delete needs the password and typing DELETE.
- **Suspended screen**, full page like the Maintenance screen: "Your account is suspended", the reason if one was given, and a "Contact support" button.

### M-Auth, M-Gating, M-Account — mobile, the same features done the native way

- **Auth.**
  - Full-screen Sign up, Sign in, Forgot password and Reset password, with native inputs, keyboard-aware layout and a large primary button pinned above the keyboard.
  - "Continue with Apple / Google" disabled "Coming soon".
  - Optional "Use Face ID next time" row (Coming soon).
- **Gating.** A **bottom sheet** opens from the gated action: Buy button, star, create alert, Portfolio tab, notifications. It has the contextual title, Create account (primary) and Sign in (secondary). The "Sign up to buy" footer goes on `order/new` as a guest.
- **Tabs as a guest:**
  - Home: the guest hero.
  - Portfolio and Watchlist: guest empty states.
  - The **Account tab** becomes a welcome screen with Create account / Sign in plus app settings (language, theme), which stay available as a guest.
- **Account (signed in):** profile header, Security (change password, sessions list, sign out of other devices), Sign out, Delete account.
- **Suspended screen.** Also show the "You were signed out" sheet for a revoked session.
- Haptics, safe areas, iOS and Android variants where they differ. Thumb-reachable primary actions.

### A-Customers and A-CustomerDetail — admin

These are new sections. Keep the existing **Users** board for admin staff and rename its nav label to **"Team"**. The old **Accounts** page merges into Customers.

- **Customers list:**
  - KPI strip: registered customers, signed up today, active (24h), suspended, verified %.
  - Search by email, name or handle, plus filters for status (active, suspended), verified, and "has open orders".
  - Table columns: customer (avatar, name, email), handle, status badge, verified, equity, all-time P&L, open orders, last active, joined.
  - Virtualized. Empty, loading and error states.
- **Customer detail** (drawer or page):
  - Header: name, email, status, verified, joined, last active.
  - Tabs: Overview (equity, cash, positions), Orders, Sessions/devices, Activity (that customer's audit trail).
  - **Admin actions**, each with a confirm dialog and a required reason:
    - Suspend / Reactivate.
    - Sign out all devices.
    - Send password reset email.
    - Reset practice account (type `RESET ACC-XXXXXX` to confirm).
  - Show what's **not** possible as a small info note: "Admins can't view passwords, trade for, or edit a customer's balance".
  - VIEWER variant: everything visible, actions disabled, with the existing "View-only access" banner. Consider masking emails for VIEWER (e.g. `m•••@gmail.com`) and show both options.
- **Overview board update:** "Registered customers" and "Guest visitors" cards, replacing "Devices".
- **Audit log:** new action chips `customer.suspend`, `customer.reactivate`, `customer.signout_all`, `customer.reset_password_sent`, `account.reset`.

## Copy (EN + AR) for the key strings

Put these on each board in both languages:

| EN                                                   | AR            |
| ---------------------------------------------------- | ------------- |
| Create account                                       | [AR]          |
| Sign in                                              | [AR]          |
| Sign up to buy {SYMBOL}                              | [AR] {SYMBOL} |
| Create an account to save {SYMBOL} to your watchlist | [AR]          |
| Your $100,000 practice account is ready              | [AR]          |
| Verify your email to secure your account             | [AR]          |
| Sign out of all other devices                        | [AR]          |
| Your account is suspended                            | [AR]          |

## Deliverable checklist

- [ ] X-AccountFlows (5 flows)
- [ ] W-Auth (5 pages × all states)
- [ ] W-Gating (ticket, modal, guest empty states, top bar, guest home, toasts, verify banner)
- [ ] W-Account (profile, security, sessions, danger zone, suspended)
- [ ] M-Auth, M-Gating, M-Account (iOS + Android where they differ)
- [ ] A-Customers, A-CustomerDetail (+ VIEWER variant), Overview and Audit updates
- [ ] Dark + light, plus one Arabic RTL artboard per board
- [ ] Dev-Notes additions: focus order, error copy, rate-limit timer, sheet/dialog motion (reuse existing motion specs), accessibility labels for every icon button
