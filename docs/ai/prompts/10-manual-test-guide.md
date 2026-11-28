# Manual test guide: Sarwa Mini Trading

This guide is for trying web, admin and mobile by hand after `pnpm dev`. Each step is one line, followed by the expected result (→).

---

## 1. Running it

### Requirements

- Node **22.x** and pnpm **10** (`packageManager: pnpm@10.34.9`).
- The **Expo Go** app on the phone, with the phone and the computer on **the same Wi-Fi**.

### Commands

```bash
cd sarwa-trading
pnpm install
pnpm dev
```

- `pnpm dev` = `turbo run dev`. It builds the packages first (`^build`), then runs all four apps together.
- The server runs `db:setup` on its own:
  - If `apps/server/.env` doesn't exist, it creates it from `.env.example`.
  - Then `prisma migrate deploy`, then `prisma db seed`.
  - The seed is safe to re-run and never deletes anything that was edited.

### Addresses

| App            | URL                                          |
| -------------- | -------------------------------------------- |
| Web (customer) | http://localhost:3000                        |
| Admin          | http://localhost:3001                        |
| Server API     | http://localhost:4000 (listens on `0.0.0.0`) |
| Metro (Expo)   | port 8081                                    |

- Web and admin reach the API from the same origin: `/api` and `/socket.io` are rewritten to `localhost:4000`.

### Mobile in Expo Go

1. Wait until Expo prints the QR code in the terminal.
   - If the QR code is lost in the turbo log, run mobile alone in a second terminal: `pnpm --filter @sarwa/mobile dev`.
2. Open the QR code: on Android from inside Expo Go, on iOS with the camera.
3. The app finds the API address by itself: it takes the computer's IP from Metro's `hostUri` and adds `:4000`.
   - To set the address yourself, put `EXPO_PUBLIC_API_URL=http://<LAN-IP>:4000` in `apps/mobile/.env`.

### Email links

- There is no real email. `LogMailer` prints the link in the **server terminal** like this:
  `{"level":"log","message":"password_reset → user@x.com http://localhost:3000/reset-password?token=…","context":"Mail"}`
- Kinds: `verify_email`, `password_reset`, `password_changed` and `admin_invite` (its link is `http://localhost:3001/invite/<token>`).
- The links point to `localhost`, so open them in the **computer's browser**.
  - To open a reset link inside Expo Go (optional): `exp://<LAN-IP>:8081/--/reset-password?token=…`.

---

## 2. Ready-made accounts (from the seed and `.env.example`)

| Type           | Email              | Password        | Note                       |
| -------------- | ------------------ | --------------- | -------------------------- |
| Customer       | `demo1@sarwa.dev`  | `practice-1234` | Sara Hamdy · `ACC-5EED01`  |
| Customer       | `demo2@sarwa.dev`  | `practice-1234` | Omar Fathy · `ACC-5EED02`  |
| Customer       | `demo3@sarwa.dev`  | `practice-1234` | Lina Adel · `ACC-5EED03`   |
| Customer       | `demo4@sarwa.dev`  | `practice-1234` | Karim Nabil · `ACC-5EED04` |
| Admin (ADMIN)  | `admin@sarwa.dev`  | `admin12345`    |                            |
| Admin (VIEWER) | `viewer@sarwa.dev` | `viewer12345`   |                            |

- The demo customers are verified, and each one has a portfolio and orders ready.

**Create a new VIEWER through an invite:**

- ☐ Sign in to admin as `admin@sarwa.dev` → go to **Team** → **Invite** → type a new email and pick **VIEWER** → send.
- ☐ Take the `admin_invite` link from the server terminal → open it in a **private (Incognito) window**.
- ☐ Enter a name and password → you should land in admin with the VIEWER role.

---

## 3. Scenarios

> **Important about the lock:** five wrong sign-in attempts lock the **account** for 15 minutes, and also lock the **IP** for 15 minutes.
>
> - The IP lock is kept in memory, so a server restart clears it.
> - The account lock is kept in the DB, so it stays until the 15 minutes are over.
> - So run the lock scenario **last**, and on a new account, not a demo one.

### Guest

- ☐ Open `/` without signing in → the guest page: hero, Create account and Sign in buttons, live top movers, the heatmap and the 3 "how it works" steps.
- ☐ Go to `/markets` and `/stocks/AAPL` → prices and the chart work.
- ☐ Do the same on the mobile Home tab → the same content.
- ☐ Tap the star (watchlist) → it opens the gate: a dialog on web, a bottom sheet on mobile.
- ☐ Open a Buy ticket and fill in the quantity → Submit opens the gate.
- ☐ Sign up from the gate → you return to the same stock, with the ticket open, **filled in** and **not submitted**. If the intent was a star, a "Saved to Watchlist" toast appears.
- ☐ If the guest had orders or positions before signing up → a toast says the account was moved over (claimed).

### Sign-up: `/signup`, or `(auth)/sign-up` on mobile

- ☐ Type a password gradually → the strength meter changes; the minimum is 8 characters.
- ☐ Try `password123` or another common password → rejected with a field error (`PASSWORD_COMMON`).
- ☐ Try `demo1@sarwa.dev` → an "email in use" error (`EMAIL_IN_USE`).
- ☐ Create a valid account → you are signed in, the portfolio has **$100,000** cash, and a welcome notification appears.
- ☐ Server terminal → it should print a `verify_email` link.

### Sign-in: `/signin`

- ☐ Sign in with a wrong password → a generic message (`INVALID_CREDENTIALS`) that doesn't say whether the email exists.
- ☐ Sign in with an email that doesn't exist → exactly the same message.
- ☐ (Last) sign in wrongly 5 times on a new account → the message "For your security we paused sign-in on this account for a few minutes." with an `m:ss` countdown, and the sign-in button disabled.
- ☐ Enter the correct password while locked → still locked until the 15 minutes are over.

### Forgot and reset password

- ☐ Sign in as `demo2` on mobile and leave it open.
- ☐ On web, go to `/forgot-password` and enter `demo2@sarwa.dev` → the "sent" screen, with a Resend button on a 60-second cooldown.
- ☐ Server terminal → take the `password_reset` link and open it → the new-password form.
- ☐ Save a new password → you are signed in, and a message says the other devices were signed out (`sessionsRevoked`).
- ☐ Mobile → "You were signed out" appears.
- ☐ Open the same link again → the **expired** state (`TOKEN_EXPIRED`).
- ☐ Note: forgot is allowed only 3 times per hour per email.
- ☐ Note: to restore `demo2`, set the password back to `practice-1234` the same way.

### Email verification

- ☐ Create a new account → open the `verify_email` link from the server terminal → the `/verify-email` page says it is verified.
- ☐ Open the link again → the expired or already-verified state.
- ☐ Resend verification → allowed once every 60 seconds.

### Sessions and devices

- ☐ Sign in as `demo1` on web and on mobile.
- ☐ On web, go to `/settings/security` → both devices show: the current one, and the other named after the phone model with a masked IP.
- ☐ On mobile, go to Account → Security → the same list.
- ☐ From web, sign out the mobile device → mobile immediately shows the "You were signed out" sheet, reason `revoked`.
- ☐ "Sign out other devices" → every other device is signed out.

### Change password

- ☐ Sign in on both devices → change the password from web (Security).
- ☐ Enter a wrong current password → `INVALID_CURRENT_PASSWORD`.
- ☐ Change it correctly → mobile shows "You were signed out", reason `password_changed`.
- ☐ Server terminal → a `password_changed` mail.

### Delete account: `/settings/danger`, or Account → Delete on mobile

- ☐ Use a new account, not a demo one.
- ☐ Type anything other than `DELETE` → the delete button stays disabled, or a confirm error appears.
- ☐ Enter the password and `DELETE` → you are signed out, every device is signed out, and a `purgeAt` date 7 days later is shown.
- ☐ Sign in again with the same account → a toast says the deletion was cancelled (`deletionCanceled`).

### Reset the practice account

- ☐ Place a few orders → go to `/settings/danger`, or Account → Reset on mobile → type `RESET`.
- ☐ Expected: cash returns to $100,000 and positions are cleared.
- ☐ In admin Audit → an `account.reset` event with actor customer.

### Admin (http://localhost:3001)

**Customers**

- ☐ `/accounts` → redirects to `/customers`.
- ☐ `/users` → redirects to `/team`.
- ☐ The KPIs show: registered, signed up today, active 24h, suspended, % verified and guest visitors.
- ☐ Search by email, name or `ACC-5EED01`, and try the status, verified and has-open-orders filters.
  - → The URL changes (`?q=…&status=…&verified=1&open=1`), and the filters survive a refresh.
- ☐ **Export CSV** as ADMIN → the file downloads with the same filters, and `customer.export` appears in Audit.

**Customer detail** (`/customers/ACC-5EED01`)

- ☐ Tabs: Overview, Orders, Sessions / devices and Activity. All of them load.

**Suspend**

- ☐ Sign in as `demo1` on mobile and web, and place an open limit order.
- ☐ In admin, Suspend → pick a category → write a reason (10 to 280 characters) → confirm.
- ☐ Mobile and web → switch **immediately** to the `/suspended` screen, showing the reason.
- ☐ Orders tab → the open order is now cancelled, with reason `account_suspended`.
- ☐ Try to sign in as `demo1` → you go to the suspended screen (`ACCOUNT_SUSPENDED`).
- ☐ **Reactivate** with a reason → sign-in works again.

**IPs**

- ☐ As ADMIN in the Sessions tab → IPs are masked (`41.32.•.•`). Click "Show full IPs" → they show in full, and `customer.pii_viewed` appears in Audit.
- ☐ Sign in as `viewer@sarwa.dev` in another window → emails are masked (`s•••@…`).
- ☐ As VIEWER → there is no Show full IPs button, Export CSV is disabled with a lock and a tooltip, and every write button is blocked.

**Team**

- ☐ Invite → the invite shows as pending, and the link is printed in the server terminal.
- ☐ **Resend** → a new link in the terminal.
- ☐ **Revoke** → opening the old link says it is expired or invalid.
- ☐ Accept a new invite in an Incognito window → the name and password form → you enter admin with the chosen role, and `user.invite` appears in Audit.
- ☐ Your own row is locked, and the last ADMIN can't be removed.

**Audit**

- ☐ Try the group chips: `customer`, `auth`, `user`, `market`, `trading`, `stock`, `config`, `halt` and `account` → the URL changes to `?group=…` and the results are filtered.

### Arabic / RTL

- ☐ **Web:** pick the language from the account menu → Arabic, the whole page is RTL, and the setting survives a refresh (cookie `sarwa.locale`).
- ☐ **Mobile:** Account or Settings → Language → Arabic, and arrows are mirrored. Also try Digits.
- ☐ **Admin:** ⚠️ there is no language switcher in the UI. Open DevTools, run `localStorage.setItem('sarwa.locale','ar')` and reload → Arabic and RTL. If it doesn't show in Arabic, log it as a bug.

### Dark / Light

- ☐ **Web:** use the theme toggle in the account menu → the colours change and no text becomes unreadable.
- ☐ **Admin:** the sun or moon icon in the top bar.
- ☐ **Mobile:** follows the system theme (labelled "System"). Change Dark mode in the phone settings → the app follows.

### Mobile offline

- ☐ Sign in and open Portfolio and Watchlist (so the cache fills).
- ☐ Turn on Airplane mode → an offline banner (WifiOff) appears, and the cached data stays visible.
- ☐ Send the app to the background and reopen it (from recents, without killing it) → it opens with the cached data.
  - Note: in Expo Go, after a full kill the app needs Metro to load, so that isn't a valid measure.
- ☐ Turn off Airplane mode → reconnecting, then the data refreshes and the banner disappears.

### Responsive

- ☐ On web, open DevTools → Device toolbar at 375px wide.
- ☐ Expected: no horizontal scroll, and the nav, the gate, the order ticket and settings are all usable.
- ☐ Try the same on admin at a small width (`/customers` and the top bar).

---

## 4. If something breaks

| Problem                                            | Fix                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Port in use** (3000 / 3001 / 4000 / 8081)        | `netstat -ano \| findstr :3000`, then `taskkill /PID <pid> /F`, or close any old `pnpm dev`.                                                                                                                                                                                                                                                                 |
| **Mobile can't reach the API**                     | Make sure both devices are on the same Wi-Fi and the Windows network is **Private**. Allow Node.js in Windows Firewall on ports 4000 and 8081. Try `http://<LAN-IP>:4000` in the phone's browser.                                                                                                                                                            |
| **Expo picked the wrong IP** (VPN / WSL / Hyper-V) | Set `EXPO_PUBLIC_API_URL=http://<LAN-IP>:4000` in `apps/mobile/.env`, or `REACT_NATIVE_PACKAGER_HOSTNAME=<LAN-IP>`, then restart Expo.                                                                                                                                                                                                                       |
| **Expo Go won't open**                             | Try `pnpm --filter @sarwa/mobile dev -- --tunnel` (needs ngrok).                                                                                                                                                                                                                                                                                             |
| **Stale Next type errors**                         | Stop dev, delete `apps/admin/.next/dev` (or `apps/web/.next/dev`), then `pnpm dev`.                                                                                                                                                                                                                                                                          |
| **The email link doesn't show**                    | Search the server terminal for `"context":"Mail"`.                                                                                                                                                                                                                                                                                                           |
| **Sign-in is locked (429)**                        | For an IP lock, restart the server. For an account lock, wait 15 minutes or use another account.                                                                                                                                                                                                                                                             |
| **You want a clean DB**                            | There is no documented, safe script that resets only the dev DB. The only existing script (`db:reset`) is `prisma migrate reset --force`, and **you must not use it**. **Ask first** before deleting anything. `pnpm dev` migrates and seeds on its own without deleting anything, and you can browse the data with `pnpm --filter @sarwa/server db:studio`. |
