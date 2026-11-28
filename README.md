# Sarwa Mini Trading

A paper-trading platform with live prices: a native Expo app, a Next.js website, a Next.js admin dashboard and a real NestJS backend, in one TypeScript monorepo where the business logic is written once.

[![CI](https://github.com/Mohammed-Abdelsalam/sarwa-trading/actions/workflows/ci.yml/badge.svg)](https://github.com/Mohammed-Abdelsalam/sarwa-trading/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-2%2C110%20passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Lighthouse (manual, local)](https://img.shields.io/badge/Lighthouse%20%28manual%2C%20local%29-a11y%20100%20%C2%B7%20SEO%20100-success)

<table align="center">
<tr>
<td align="center" valign="middle">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/web-markets.png">
    <img src="docs/screenshots/light/web-markets.png" alt="The markets page on the web app, with live prices" width="660">
  </picture>
  <br><sub><b>Web</b> · Next.js</sub>
</td>
<td align="center" valign="middle">
  <img src="docs/screenshots/mobile-app/watchlist-dark.jpg" alt="The native Expo app on a real phone: watchlist with live prices" width="190">
  <br><sub><b>Mobile app</b> · Expo, on a real phone</sub>
</td>
</tr>
</table>

## Contents

1. [TL;DR](#tldr)
2. [Quick start](#quick-start)
3. [Key decisions](#key-decisions)
4. [The brief, and how each requirement is met](#the-brief-and-how-each-requirement-is-met)
5. [What I added beyond the brief, and why](#what-i-added-beyond-the-brief-and-why)
6. [Screenshots](#screenshots)
7. [Admin dashboard](#admin-dashboard)
8. [Architecture](#architecture)
9. [Tech stack](#tech-stack)
10. [Performance](#performance)
11. [Security](#security)
12. [Quality and testing](#quality-and-testing)
13. [How I worked with AI](#how-i-worked-with-ai)
14. [Known limitations](#known-limitations)
15. [Roadmap](#roadmap)
16. [Repository map and further reading](#repository-map-and-further-reading)

## TL;DR

- **Three clients, one brain.** An Expo app (iOS and Android, runs in Expo Go), a Next.js customer website and a separate Next.js admin dashboard. All client logic lives in [`@sarwa/core`](packages/core/README.md); each app adds only its view layer.
- **Next.js for the web, on purpose.** Expo for Web could have shipped the same code to the browser; I chose dedicated Next.js apps for web-native strengths (SSR/RSC, SEO, a nonce CSP, semantic HTML), with all business logic still shared in `@sarwa/core`. ([ADR 0002](docs/adr/0002-expo-mobile-nextjs-web-and-admin.md))
- **A real backend, not a mock.** NestJS + Prisma + SQLite with a simulated market that ticks every 500 ms, a trading engine, customer accounts and an admin API. `pnpm install && pnpm dev` runs everything with nothing else to install.
- **Live everywhere.** Socket.IO rooms per symbol, a server snapshot for the first paint, then a batched stream; a tick re-renders only the rows whose price changed.
- **The brief, then the product around it.** Stock list, stock detail with 1D/1W/1M/1Y/ALL charts and a watchlist that works for guests, plus paper trading, alerts, accounts, an admin console, Arabic/RTL, dark mode and offline cache.
- **2,110 automated tests**, all passing, with per-workspace coverage floors enforced in CI (domain at 100%).
- **Measured by hand.** Manual, local Lighthouse runs on the production web build (not in CI): home page performance 93 mobile / 100 desktop, accessibility 100, SEO 100, and best practices 100 on the home page. The mobile LCP fix is under [Performance](#performance).
- **The AI setup is committed.** `CLAUDE.md`, subagent roles, slash commands, rules and the real prompts are all in the repo, with the incidents that shaped them.

## Quick start

### Prerequisites

- **Node 22** (`.nvmrc`)
- **pnpm 10** through corepack: `corepack enable` (the exact version is pinned in `packageManager`)

### Run everything

```bash
pnpm install
pnpm dev
```

`pnpm dev` builds the shared packages, creates `apps/server/.env` from `.env.example` if it is missing, applies the migrations, seeds the database, and starts every app:

| App                 | URL                                |
| ------------------- | ---------------------------------- |
| Web (customer)      | http://localhost:3000              |
| Admin dashboard     | http://localhost:3001              |
| API (REST)          | http://localhost:4000/api/v1       |
| Expo Metro (mobile) | port 8081, QR code in the terminal |

### Mobile in Expo Go

1. Install **Expo Go** on your phone and connect it to the **same Wi-Fi** as your computer. Allow ports 8081 and 4000 through the firewall.
2. Scan the QR code that Metro prints (`pnpm dev`, or `pnpm --filter @sarwa/mobile dev` on its own).
3. The app finds the API by itself: in development, [`api-url.ts`](apps/mobile/src/lib/api-url.ts) uses `EXPO_PUBLIC_API_URL` if set, otherwise the LAN IP Metro is served from plus port 4000. The server listens on `0.0.0.0:4000` for this reason. Release builds require an `https://` `EXPO_PUBLIC_API_URL`.

More in the [mobile README](apps/mobile/README.md).

### Demo accounts

Seeded in development only (the seed skips them in production).

| Where          | Email                                 | Password        | Notes                         |
| -------------- | ------------------------------------- | --------------- | ----------------------------- |
| Web and mobile | `demo1@sarwa.dev` … `demo4@sarwa.dev` | `practice-1234` | Customers with seeded trades  |
| Admin          | `admin@sarwa.dev`                     | `admin12345`    | ADMIN: full access            |
| Admin          | `viewer@sarwa.dev`                    | `viewer12345`   | VIEWER: read-only, PII masked |

Or browse as a guest and sign up yourself. **Emails are never sent:** `LogMailer`, the only `Mailer`, prints each link to the server log as JSON lines with `"context":"Mail"`. A real mailer is on the roadmap.

### Useful scripts

| Command              | What it does                                                       |
| -------------------- | ------------------------------------------------------------------ |
| `pnpm test`          | Every Jest suite in the monorepo                                   |
| `pnpm test:coverage` | The same, with coverage floors enforced (the exact script CI runs) |
| `pnpm lint`          | ESLint, including the package-boundary rules                       |
| `pnpm typecheck`     | `tsc` in every workspace                                           |
| `pnpm build`         | Production builds of every package and app                         |
| `pnpm format:check`  | Prettier check (also in CI)                                        |

One workspace: `pnpm turbo run typecheck lint test --filter=@sarwa/<name>`.

## Key decisions

> **Why not Expo for Web?** Expo for Web could have shipped the same React Native code to the browser. I chose dedicated Next.js apps for the website and the admin dashboard on purpose. I'm a frontend web engineer first, and the web deserves web-native strengths: SSR and React Server Components with a snapshot-then-stream first paint, SEO and JSON-LD, a strict nonce CSP, the App Router, and semantic, accessible HTML (Lighthouse accessibility and SEO 100 in manual local runs). The business logic is still written once in `@sarwa/core` and shared by all three clients, so the cost of a second UI is only the view layer. ([ADR 0002](docs/adr/0002-expo-mobile-nextjs-web-and-admin.md))

| ADR                                                                 | Decision                                                                          | Why                                                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [0001](docs/adr/0001-monorepo-pnpm-turborepo.md)                    | pnpm workspaces + Turborepo, boundaries enforced by ESLint                        | One PR can change a contract, the server and all clients together; layering can't erode silently. |
| [0002](docs/adr/0002-expo-mobile-nextjs-web-and-admin.md)           | Expo for mobile, dedicated Next.js for web and admin                              | Each platform gets its own strengths; only the view layer is written twice.                       |
| [0003](docs/adr/0003-share-logic-not-ui.md)                         | Share logic, not UI: view-model hook + render-only components                     | A rule fixed once is fixed everywhere; an early review found real drift bugs when it wasn't.      |
| [0004](docs/adr/0004-shared-zod-contracts.md)                       | Zod contracts for every HTTP and socket payload, checked on both sides            | One schema gives both the type and the runtime check.                                             |
| [0005](docs/adr/0005-real-backend-nestjs-prisma-sqlite.md)          | NestJS + Prisma + SQLite instead of mocks                                         | Real shared state and auth, still zero-install.                                                   |
| [0006](docs/adr/0006-realtime-socketio-snapshot-stream.md)          | Socket.IO rooms per symbol, snapshot then stream, batching on both ends           | Bounded traffic and renders, correct order after reconnects.                                      |
| [0007](docs/adr/0007-integer-money-and-serialized-execution.md)     | Branded integer money, one serialized execution queue, idempotency keys           | The books balance to the cent; retries on flaky networks are safe.                                |
| [0008](docs/adr/0008-customer-accounts-and-sessions.md)             | argon2id, rotating refresh with reuse detection, cookies on web, bearer on mobile | Immediate revocation; no token readable by page scripts.                                          |
| [0009](docs/adr/0009-guest-watchlist-device-account.md)             | Guest watchlist on a device account, claimed at sign-up                           | The brief's own feature works without signing up, and nothing is lost when you do.                |
| [0010](docs/adr/0010-arabic-and-rtl-first-class.md)                 | Arabic and RTL as a first-class locale                                            | The target market; server-rendered `lang`/`dir`, so no English flash.                             |
| [0011](docs/adr/0011-testing-jest-and-coverage-floors.md)           | Jest everywhere, per-workspace coverage floors                                    | One runner; floors that match each layer's role.                                                  |
| [0012](docs/adr/0012-admin-dashboard-separate-app.md)               | Admin as a separate app with roles, PII masking and audit                         | Staff tooling stays out of the customer bundle; least privilege by default.                       |
| [0013](docs/adr/0013-security-headers-csp-client-ip-rate-limits.md) | Nonce CSP, security headers, real client IP, in-memory rate limits                | Strict scripts without `unsafe-inline`; limits that can't be dodged by spoofing an IP.            |

## The brief, and how each requirement is met

| Requirement                                               | Where                                                                                                                                                                                              | How                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stock list** with name and live price                   | Server [`market/`](apps/server/src/market), core [`market-socket.ts`](packages/core/src/market-socket.ts) + [`hooks/live.ts`](packages/core/src/hooks/live.ts), web `/markets`, mobile Markets tab | A Socket.IO room per symbol: a snapshot on subscribe, then one batched `quotes` message per socket every 250 ms; `useQuote(symbol)` re-renders only that row.<br>On mobile only visible rows subscribe; the web list is small, so every listed row streams. [ADR 0006](docs/adr/0006-realtime-socketio-snapshot-stream.md) |
| **Stock detail** with live price and historical chart     | Web `/stocks/[symbol]`, mobile `stock/[symbol]`, server candles endpoint, core `chartGeometry`                                                                                                     | Periods 1D, 1W, 1M, 1Y and ALL (the enabled set is admin-configurable). History is generated to end at the current price, and the live tick moves the header. Web renders the page as server components with client islands and plain SVG charts; mobile has a Reanimated scrubber with haptics.                           |
| **Watchlist**: star favourites, reflected across the app  | Server [`watchlist/`](apps/server/src/watchlist), core [`hooks/watchlist.ts`](packages/core/src/hooks/watchlist.ts), web `/watchlist`, mobile Watchlist tab                                        | Stars work **without an account**: a guest's stars live on a device account. Signing up moves them to the new user; signing in merges them. A star updates every list, detail page and the watchlist screen at once through the shared query cache. See [ADR 0009](docs/adr/0009-guest-watchlist-device-account.md).       |
| **Mock backend allowed, must behave like the real thing** | [`apps/server`](apps/server/README.md)                                                                                                                                                             | I built the real thing instead: REST + Socket.IO, a database, auth, and live updates shared by every client. See [ADR 0005](docs/adr/0005-real-backend-nestjs-prisma-sqlite.md).                                                                                                                                           |
| **Code a team will keep building on**                     | Whole repo                                                                                                                                                                                         | Lint-enforced package boundaries, shared Zod contracts, one view-model hook per screen, 13 ADRs, coverage floors in CI, and an AI setup a new contributor (human or agent) can follow.                                                                                                                                     |
| **Commit your AI setup**                                  | [`CLAUDE.md`](CLAUDE.md), [`.claude/`](.claude), [`docs/ai/`](docs/ai/README.md)                                                                                                                   | See [How I worked with AI](#how-i-worked-with-ai).                                                                                                                                                                                                                                                                         |

## What I added beyond the brief, and why

| Addition                                                                                                                         | Why                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A real backend** instead of mocks                                                                                              | A mock can't show shared live state: the same tick, fill or halt reaching every client at once. ([ADR 0005](docs/adr/0005-real-backend-nestjs-prisma-sqlite.md))                                     |
| **Paper trading**: market, limit and stop orders, a ticket with a live estimate, a serialized execution queue, portfolio and P&L | It gives the live prices a purpose, and it is where correctness matters: integer money, idempotent orders, no double-spend. ([ADR 0007](docs/adr/0007-integer-money-and-serialized-execution.md))    |
| **Price alerts and notifications**                                                                                               | The natural companion to a watchlist; delivered live over the socket and listed in-app.                                                                                                              |
| **Customer accounts and sessions**                                                                                               | Trading needs identity. argon2id, rotating refresh tokens, cookies on web and SecureStore on mobile; guests can still browse and star. ([ADR 0008](docs/adr/0008-customer-accounts-and-sessions.md)) |
| **Admin dashboard**: customers, team invites, market control, halts, kill switch, maintenance mode, audit log                    | A broker needs operators; it also proves the realtime design (halt a symbol, every client reacts). ([ADR 0012](docs/adr/0012-admin-dashboard-separate-app.md))                                       |
| **Arabic and RTL** with a separate digits setting                                                                                | Sarwa serves the Gulf market; Arabic is a product requirement, not polish. ([ADR 0010](docs/adr/0010-arabic-and-rtl-first-class.md))                                                                 |
| **Dark and light themes**                                                                                                        | Expected in a finance app; both come from one token set with no flash on load.                                                                                                                       |
| **Offline cache** on mobile                                                                                                      | The app opens with the last known stocks, watchlist and portfolio, per user, and resumes the stream when the network returns.                                                                        |
| **Security hardening**                                                                                                           | Nonce CSP, CSRF, real client IP, rate limits, server-side PII masking. ([SECURITY.md](SECURITY.md))                                                                                                  |
| **Performance work**                                                                                                             | Live prices on every screen are expensive unless renders are bounded. ([docs/performance.md](docs/performance.md))                                                                                   |
| **Accessibility**                                                                                                                | Semantic HTML, focus management, reduced-motion support, `jsx-a11y` lint; Lighthouse accessibility 100 in manual runs.                                                                               |
| **CI coverage floors**                                                                                                           | A floor per layer keeps the shared logic honest as the team grows. ([ADR 0011](docs/adr/0011-testing-jest-and-coverage-floors.md))                                                                   |

## Screenshots

<p align="center">
  <img src="docs/screenshots/live-prices.gif" alt="Prices ticking live on the markets page" width="820">
  <br><sub>Live prices streaming over Socket.IO: only the rows whose price changed re-render.</sub>
</p>

### Brief screens: light and dark

<table>
<tr><th width="50%">Light</th><th width="50%">Dark</th></tr>
<tr>
<td width="50%"><img src="docs/screenshots/light/web-stock.png" alt="Stock detail with live price and chart periods, light theme" width="420"></td>
<td width="50%"><img src="docs/screenshots/dark/web-stock.png" alt="Stock detail with live price and chart periods, dark theme" width="420"></td>
</tr>
<tr><td colspan="2" align="center"><sub>Stock detail with live price and chart periods</sub></td></tr>
<tr>
<td width="50%"><img src="docs/screenshots/light/web-watchlist.png" alt="Watchlist, light theme" width="420"></td>
<td width="50%"><img src="docs/screenshots/dark/web-watchlist.png" alt="Watchlist, dark theme" width="420"></td>
</tr>
<tr><td colspan="2" align="center"><sub>Watchlist</sub></td></tr>
</table>

### Native app on a real device

The Expo app running in Expo Go on a real phone (dark theme).

<table>
<tr>
<td width="33%" align="center"><img src="docs/screenshots/mobile-app/portfolio-dark.jpg" alt="Native app: Portfolio" width="240"><br><sub>Portfolio</sub></td>
<td width="33%" align="center"><img src="docs/screenshots/mobile-app/watchlist-dark.jpg" alt="Native app: Watchlist" width="240"><br><sub>Watchlist</sub></td>
<td width="33%" align="center"><img src="docs/screenshots/mobile-app/account-dark.jpg" alt="Native app: Account for a test customer whose email is not verified yet" width="240"><br><sub>Account (test customer, email not verified yet)</sub></td>
</tr>
</table>

### Accounts and sign-in

Guests browse freely; signing in unlocks trading, alerts and sessions. Shown with the seeded demo accounts.

<table>
<tr><th width="50%">Light</th><th width="50%">Dark</th></tr>
<tr>
<td width="50%"><img src="docs/screenshots/light/web-signin.png" alt="Sign-in page, light theme" width="420"></td>
<td width="50%"><img src="docs/screenshots/dark/web-signin.png" alt="Sign-in page, dark theme" width="420"></td>
</tr>
<tr><td colspan="2" align="center"><sub>Sign in with "Keep me signed in"</sub></td></tr>
<tr>
<td width="50%"><img src="docs/screenshots/light/web-account-menu.png" alt="Account menu of a signed-in customer, light theme" width="420"></td>
<td width="50%"><img src="docs/screenshots/dark/web-account-menu.png" alt="Account menu of a signed-in customer, dark theme" width="420"></td>
</tr>
<tr><td colspan="2" align="center"><sub>Account menu: equity, buying power, settings, theme, language and digits</sub></td></tr>
<tr>
<td width="50%"><img src="docs/screenshots/light/web-security.png" alt="Security settings with active sessions, light theme" width="420"></td>
<td width="50%"><img src="docs/screenshots/dark/web-security.png" alt="Security settings with active sessions, dark theme" width="420"></td>
</tr>
<tr><td colspan="2" align="center"><sub>Security: profile and active sessions on two devices, each can be signed out</sub></td></tr>
</table>

### Arabic / RTL

<p align="center">
  <img src="docs/screenshots/rtl/web-ar.jpg" alt="The web home page as a guest in Arabic, mirrored right to left" width="820">
  <br><sub>The guest home page in Arabic: the layout mirrors right to left, and prices keep Western digits by default.</sub>
</p>

<details>
<summary><b>More web screens</b>: home, order ticket, portfolio, sign-up (click to expand)</summary>

<table>
<tr><th width="50%">Light</th><th width="50%">Dark</th></tr>
<tr>
<td width="50%"><img src="docs/screenshots/light/web-home-guest.png" alt="Home as a guest, light theme" width="420"></td>
<td width="50%"><img src="docs/screenshots/dark/web-home-guest.png" alt="Home as a guest, dark theme" width="420"></td>
</tr>
<tr><td colspan="2" align="center"><sub>Home as a guest</sub></td></tr>
<tr>
<td width="50%"><img src="docs/screenshots/light/web-ticket.png" alt="Order ticket with a live estimate, light theme" width="420"></td>
<td width="50%"><img src="docs/screenshots/dark/web-ticket.png" alt="Order ticket with a live estimate, dark theme" width="420"></td>
</tr>
<tr><td colspan="2" align="center"><sub>Order ticket with a live estimate</sub></td></tr>
<tr>
<td width="50%"><img src="docs/screenshots/light/web-portfolio.png" alt="Portfolio and P&amp;L, light theme" width="420"></td>
<td width="50%"><img src="docs/screenshots/dark/web-portfolio.png" alt="Portfolio and P&amp;L, dark theme" width="420"></td>
</tr>
<tr><td colspan="2" align="center"><sub>Portfolio and P&amp;L</sub></td></tr>
<tr>
<td width="50%"><img src="docs/screenshots/light/web-signup.png" alt="Sign-up, light theme" width="420"></td>
<td width="50%"><img src="docs/screenshots/dark/web-signup.png" alt="Sign-up, dark theme" width="420"></td>
</tr>
<tr><td colspan="2" align="center"><sub>Sign-up</sub></td></tr>
</table>

</details>

<details>
<summary><b>Responsive web at phone width</b> (click to expand)</summary>

<table>
<tr>
<td width="25%" align="center"><img src="docs/screenshots/light/web-mobile-home.png" alt="Web at phone width: Home, light theme" width="200"><br><sub>Home (light)</sub></td>
<td width="25%" align="center"><img src="docs/screenshots/light/web-mobile-markets.png" alt="Web at phone width: Markets, light theme" width="200"><br><sub>Markets (light)</sub></td>
<td width="25%" align="center"><img src="docs/screenshots/light/web-mobile-stock.png" alt="Web at phone width: Stock, light theme" width="200"><br><sub>Stock (light)</sub></td>
<td width="25%" align="center"><img src="docs/screenshots/light/web-mobile-watchlist.png" alt="Web at phone width: Watchlist, light theme" width="200"><br><sub>Watchlist (light)</sub></td>
</tr>
<tr>
<td width="25%" align="center"><img src="docs/screenshots/dark/web-mobile-home.png" alt="Web at phone width: Home, dark theme" width="200"><br><sub>Home (dark)</sub></td>
<td width="25%" align="center"><img src="docs/screenshots/dark/web-mobile-markets.png" alt="Web at phone width: Markets, dark theme" width="200"><br><sub>Markets (dark)</sub></td>
<td width="25%" align="center"><img src="docs/screenshots/dark/web-mobile-stock.png" alt="Web at phone width: Stock, dark theme" width="200"><br><sub>Stock (dark)</sub></td>
<td width="25%" align="center"><img src="docs/screenshots/dark/web-mobile-watchlist.png" alt="Web at phone width: Watchlist, dark theme" width="200"><br><sub>Watchlist (dark)</sub></td>
</tr>
</table>

</details>

## Admin dashboard

A separate Next.js app on http://localhost:3001 with two roles, ADMIN and VIEWER ([ADR 0012](docs/adr/0012-admin-dashboard-separate-app.md)). Every write requires ADMIN and is written to the audit log. Sign in with `admin@sarwa.dev` / `admin12345` (ADMIN) or `viewer@sarwa.dev` / `viewer12345` (VIEWER, read-only).

### Control the market live

Each change reaches every connected web and mobile client at once over Socket.IO (`market:status`, `config:updated`, `trading.status`, `symbol.halted` / `symbol.resumed`), with no refresh.

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-market-control.png"><img src="docs/screenshots/light/admin-market-control.png" alt="Market control room: market running, volatility and drop connections" width="820"></picture>
  <br><sub>Market control room: market status, volatility and drop connections, with a live ticker.</sub>
</p>

<table>
<tr><th width="20%">Admin action</th><th width="40%">Admin dashboard</th><th width="40%">Customer web app, live</th></tr>
<tr>
<td width="20%"><b>Pause and resume the market</b><br>Prices freeze and every client shows a "Market paused, prices are frozen" notice; trading picks up again the moment an admin resumes.</td>
<td width="40%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-market-paused.png"><img src="docs/screenshots/light/admin-market-paused.png" alt="Admin market control with the market paused" width="360"></picture></td>
<td width="40%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/web-live-paused.png"><img src="docs/screenshots/light/web-live-paused.png" alt="Customer web app showing the market paused" width="360"></picture></td>
</tr>
<tr>
<td width="20%"><b>Halt a symbol, or the kill switch</b><br>Shown: a TSLA halt with the reason "Pending news announcement", next to the kill switch, circuit breaker and session mode. The kill switch turns off Buy and Sell for everyone while prices stay live; the customer sees "TSLA halted" with submit disabled.</td>
<td width="40%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-trading.png"><img src="docs/screenshots/light/admin-trading.png" alt="Admin trading controls with the kill switch and a halted symbol" width="360"></picture></td>
<td width="40%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/web-live-halt.png"><img src="docs/screenshots/light/web-live-halt.png" alt="Customer web app showing a halted symbol" width="360"></picture></td>
</tr>
<tr>
<td width="20%"><b>Banner message</b><br>"Markets close early today at 1:00 PM ET", with a live web and mobile preview; shown at the top of both apps, empty hides it.</td>
<td width="40%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-config.png"><img src="docs/screenshots/light/admin-config.png" alt="Admin configuration with the banner message" width="360"></picture></td>
<td width="40%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/web-live-banner.png"><img src="docs/screenshots/light/web-live-banner.png" alt="Customer web app showing the admin banner" width="360"></picture></td>
</tr>
<tr>
<td width="20%"><b>Maintenance mode</b><br>Every client screen is replaced with "We'll be right back" and the server blocks writes; admin stays available.</td>
<td width="40%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-config.png"><img src="docs/screenshots/light/admin-config.png" alt="Admin configuration with the maintenance mode toggle" width="360"></picture></td>
<td width="40%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/web-live-maintenance.png"><img src="docs/screenshots/light/web-live-maintenance.png" alt="Customer web app in maintenance mode" width="360"></picture></td>
</tr>
</table>

### Manage customers, team and audit

<table>
<tr>
<td width="50%" align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-overview.png"><img src="docs/screenshots/light/admin-overview.png" alt="Admin overview" width="420"></picture><br><sub><b>Overview</b>: connected clients, symbol streams, top watchlisted stocks, the live market and recent sign-ins and admin actions, refreshed every 10 s.</sub></td>
<td width="50%" align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-customers.png"><img src="docs/screenshots/light/admin-customers.png" alt="Customers list" width="420"></picture><br><sub><b>Customers</b>: search and filter; emails and IPs masked on the server.</sub></td>
</tr>
<tr>
<td width="50%" align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-customer-actions.png"><img src="docs/screenshots/light/admin-customer-actions.png" alt="Customer detail with an action dialog and a reason field" width="420"></picture><br><sub><b>Customer actions</b>: suspend, reactivate, sign out and reset each need a reason of 10 to 280 characters. Suspension cancels open orders and signs the customer out on every device within seconds; revealing IPs is audited.</sub></td>
<td width="50%" align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-stocks.png"><img src="docs/screenshots/light/admin-stocks.png" alt="Stocks management" width="420"></picture><br><sub><b>Stocks</b>: add, enable and tune the symbols the simulator runs (base price, volatility, sector, exchange).</sub></td>
</tr>
<tr>
<td width="50%" align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-team.png"><img src="docs/screenshots/light/admin-team.png" alt="Team members and a pending invite" width="420"></picture><br><sub><b>Team</b>: ADMIN and VIEWER roles; single-use email invites expire in 48 hours.</sub></td>
<td width="50%" align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-audit.png"><img src="docs/screenshots/light/admin-audit.png" alt="Audit log" width="420"></picture><br><sub><b>Audit log</b>: every sign-in and admin action, with its payload.</sub></td>
</tr>
</table>

### Read-only VIEWER

A VIEWER sees masked emails and locked controls, and the server answers any write with 403: masking happens on the server, so the browser never receives the data.

<table>
<tr>
<td width="50%" align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-viewer-customers.png"><img src="docs/screenshots/light/admin-viewer-customers.png" alt="Customers as a VIEWER, with masked emails" width="420"></picture><br><sub>Customers as a VIEWER: emails masked (d•••@sarwa.dev), Export CSV locked</sub></td>
<td width="50%" align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-viewer-readonly.png"><img src="docs/screenshots/light/admin-viewer-readonly.png" alt="Read-only notice and disabled controls for a VIEWER" width="420"></picture><br><sub>Read-only badge; Pause and Drop connections locked</sub></td>
</tr>
</table>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/dark/admin-login.png"><img src="docs/screenshots/light/admin-login.png" alt="Admin sign-in" width="360"></picture>
  <br><sub>Admin sign-in</sub>
</p>

## Architecture

```mermaid
flowchart LR
  subgraph Clients
    M["Mobile<br/>Expo · React Native"]
    W["Web<br/>Next.js 16"]
    A["Admin<br/>Next.js 16"]
  end
  subgraph Server["apps/server · NestJS"]
    API["REST /api/v1"]
    WS["Socket.IO /market · /admin"]
    ENG["Simulator · execution queue"]
    DB[("SQLite · Prisma")]
  end
  M -- "bearer token" --> API
  M --> WS
  W -- "same-origin rewrite + cookies" --> API
  W --> WS
  A -- "same-origin rewrite + cookie" --> API
  A --> WS
  API --- ENG --- DB

  subgraph Packages
    CORE["@sarwa/core<br/>API client · socket · hooks · view data"]
    UI["@sarwa/ui<br/>DOM components"]
    C["@sarwa/contracts<br/>Zod schemas"]
    D["@sarwa/domain<br/>pure rules"]
    I["@sarwa/i18n"]
    T["@sarwa/tokens"]
  end
  CORE --> C --> D
  CORE --> I
  CORE --> T
  M -.-> CORE
  W -.-> CORE
  A -.-> CORE
  W -.-> UI
  A -.-> UI
  Server -.-> C
```

**Shared logic, separate UI.** Every rule that more than one client needs lives in a package: pure trading rules in `@sarwa/domain`, wire schemas in `@sarwa/contracts`, and the API client, socket, live-quote store, React Query hooks and view data in `@sarwa/core`. Each screen in each app is one view-model hook (`use-*-page.ts` on web and admin, `use-*-screen.ts` on mobile) that calls core, plus components that only render. ESLint enforces it: render-only files can't import React Query, core can't import React Native or Next, the server can't import client packages, and nothing reaches into another package's `src`. The result is three native-feeling UIs with one behaviour.

```text
apps/
  server/     NestJS API, Socket.IO, market simulator, trading engine, Prisma + SQLite   → README
  web/        Customer website, Next.js 16 App Router, Tailwind v4                      → README
  admin/      Admin dashboard, Next.js 16                                                → README
  mobile/     Customer app, Expo SDK 58, Expo Router, NativeWind                         → README
packages/
  domain/     Pure rules: integer money, orders, fills, portfolio, market hours          → README
  contracts/  Zod schemas, routes, socket events, error codes, shared constants          → README
  core/       Shared client logic for all three apps                                     → README
  i18n/       Typed EN and AR catalogs, plurals, number and date formatting              → README
  tokens/     Design tokens, Tailwind preset, CSS variables                              → README
  ui/         Shared DOM components and Next config for web and admin                    → README
  eslint-config/ jest-config/ tsconfig/   Shared tooling
```

Workspace READMEs: [server](apps/server/README.md) · [web](apps/web/README.md) · [admin](apps/admin/README.md) · [mobile](apps/mobile/README.md) · [domain](packages/domain/README.md) · [contracts](packages/contracts/README.md) · [core](packages/core/README.md) · [i18n](packages/i18n/README.md) · [tokens](packages/tokens/README.md) · [ui](packages/ui/README.md) · [eslint-config](packages/eslint-config/README.md) · [jest-config](packages/jest-config/README.md) · [tsconfig](packages/tsconfig/README.md)

The full picture (dependency rules, data flow, auth transports, realtime path) is in [docs/architecture.md](docs/architecture.md).

## Tech stack

<details>
<summary><b>Area → tools → why</b> (click to expand)</summary>

| Area                    | Tools                                                                                                                                                           | Why                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Monorepo                | pnpm 10 workspaces, Turborepo 2, TypeScript 6 (strict, `noUncheckedIndexedAccess`)                                                                              | Atomic cross-package changes, cached tasks, strict `node_modules` catches undeclared deps.          |
| Mobile                  | Expo SDK 58, React Native 0.88, Expo Router, FlashList, Reanimated 4, Gesture Handler, SecureStore, NetInfo, Haptics                                            | Runs in Expo Go with no native build; native lists, animations off the JS thread, keychain storage. |
| Web                     | Next.js 16 App Router, React 19 (React Compiler), `next/font`                                                                                                   | SSR/RSC with a data snapshot, SEO, per-request CSP, route-level loading and error states.           |
| Admin                   | Next.js 16, the same `@sarwa/ui` and `@sarwa/core/admin`                                                                                                        | A separate deploy and stricter cookie, at the cost of view code only.                               |
| Server                  | NestJS 11, `@nestjs/throttler`, helmet, `@node-rs/argon2`, bcryptjs (verifies legacy admin hashes, then rehashes them to argon2id), `@nestjs/jwt`, ua-parser-js | Modules, guards, pipes and gateways out of the box; auth and validation declared once.              |
| Data                    | Prisma 6, SQLite (`BigInt` money columns)                                                                                                                       | Typed queries, migrations and transactions with zero install; a schema ready for Postgres.          |
| Realtime                | Socket.IO 4 (server and `socket.io-client`)                                                                                                                     | Rooms, acks, reconnection and a polling fallback.                                                   |
| Validation              | Zod 4 in `@sarwa/contracts` (jitless, CSP-safe)                                                                                                                 | One schema = type + runtime check on both sides of every boundary.                                  |
| State and data fetching | TanStack Query 5 (+ AsyncStorage persister on mobile), zustand 5 for live quotes                                                                                | Server cache with targeted invalidation; a tiny store with per-symbol selectors for ticks.          |
| Styling and tokens      | `@sarwa/tokens` → Tailwind v4 (web, admin), NativeWind 4 (mobile); Radix primitives, CVA, lucide icons                                                          | One design-token source for three apps; accessible primitives on the DOM side.                      |
| i18n                    | `@sarwa/i18n` (own typed catalogs, CLDR plurals written out)                                                                                                    | Light, shared by RN, RSC and Nest; works on Hermes without `Intl.PluralRules`.                      |
| Testing                 | Jest 30 + `@swc/jest`, jest-expo, Testing Library (React, React Native, jest-dom), supertest, `socket.io-client`                                                | One runner everywhere; server tests run end-to-end on a real database.                              |
| Tooling and CI          | ESLint 9 (typescript-eslint, jsx-a11y, import rules), Prettier, Husky, lint-staged, commitlint, GitHub Actions                                                  | Boundaries and conventions enforced by machines, locally and in CI.                                 |

</details>

## Performance

Full write-up with file references: [docs/performance.md](docs/performance.md). Lighthouse score table: [docs/performance/lighthouse](docs/performance/lighthouse/README.md).

- **Shared core:** ticks fill a buffer flushed every 100 ms (one store update per batch); a `ts`/`seq` check drops stale and duplicate quotes; per-symbol selectors so a tick re-renders only its rows; ref-counted subscriptions synced 200 ms after changes, in chunks of 50; query `staleTime`s per data type and socket-driven invalidation instead of polling.
- **Mobile:** FlashList for long lists with memoised rows; only on-screen rows stream; price flash, chart scrubber and gestures on Reanimated (UI thread, reduced-motion aware); the socket pauses only when the app goes to the background; a per-user offline cache (24 h, busted on app version); React Compiler on.
- **Web:** the root layout prefetches stocks and trading status on the server (5 s cache, status always fresh) and the socket takes over after hydration; client islands only where interactive; SVG charts with no chart library; only the Latin fonts every first paint needs are preloaded; a guest fast path skips the `/me` round trip.
  - **Lighthouse (manual, local, production build):** home mobile — performance **93**, accessibility **100**, best practices **100**, SEO **100**; home desktop **100**; stock page **98** mobile, **100** desktop. Home LCP on the mobile preset **4.5 s → 0.8 s**.
- **Admin:** server-side cursor pagination; stats poll every 10 s only while the tab is visible; Lighthouse best practices 100 on `/login` (manual).
- **Server:** one serialized execution queue (no row locks needed); portfolio valuation for any number of accounts in a fixed number of queries; batched notifications; equity snapshots compacted hourly/daily; one `quotes` message per socket per 250 ms.

## Security

Threat model, every control with its source file, and limitations: [SECURITY.md](SECURITY.md).

- **Auth and sessions:** argon2id (with a dummy hash for unknown emails, so timing reveals nothing); 15-minute access JWTs with separate customer and admin audiences; opaque refresh tokens stored hashed, rotated on every use, reuse revokes the family; revocation pushed over the socket; lockout and per-route rate limits.
- **Web:** httpOnly `SameSite` cookies, CSRF double-submit plus Origin/`Sec-Fetch-Site` checks; a same-origin API proxy; a per-request nonce CSP with `strict-dynamic`, HSTS, `X-Frame-Options: DENY` and a strict Permissions-Policy.
- **Mobile:** tokens, the saved user and the device id in SecureStore; no secrets in the bundle; release builds refuse a non-HTTPS API; Android backups off.
- **Server:** default-deny global guard (`@Public()` to opt out); Zod validation of every body, query, param and socket payload; helmet and an allow-listed CORS; a client IP that can't be spoofed through the Next proxies; weak `JWT_SECRET` refused in production; maintenance mode blocks writes.
- **Admin and PII:** ADMIN and VIEWER roles: every admin write route requires the ADMIN role (`@Roles(['ADMIN'])`), with VIEWER → 403 tests on the key ones (market, trading, halts, suspend, reveal, export); emails and IPs masked on the server, so a VIEWER's browser never receives them; audited reveal and export; invite-only team with 48-hour single-use links; retention jobs for audit IPs and ended sessions.

## Quality and testing

CI runs the same `pnpm test:coverage` script developers run, so a coverage floor fails locally before it fails in CI.

<details>
<summary><b>Testing matrix</b> (click to expand)</summary>

| Workspace          | What is tested                                                                               | Tests | Coverage floor (stmts / branches / funcs / lines) |
| ------------------ | -------------------------------------------------------------------------------------------- | ----: | ------------------------------------------------- |
| `@sarwa/core`      | API client and auth transports, socket tick buffer, quote ordering, hooks, view data, gating |   453 | 80 / 75 / 80 / 80                                 |
| `@sarwa/contracts` | Every schema, routes, socket events, Zod config                                              |   298 | 95 / 95 / 95 / 95                                 |
| `@sarwa/domain`    | Money units, order validation, fills, portfolio, market calendar, alerts                     |   278 | **100 / 100 / 100 / 100**                         |
| `@sarwa/mobile`    | View-models and screens with jest-expo and React Native Testing Library                      |   264 | 53 / 49 / 55 / 54                                 |
| `@sarwa/web`       | View-models, render-only components, SEO files, server snapshot fetches, Next config         |   238 | 65 / 52 / 56 / 66                                 |
| `@sarwa/server`    | Unit tests plus end-to-end suites on a real SQLite database (supertest, `socket.io-client`)  |   202 | none (e2e-driven)                                 |
| `@sarwa/i18n`      | EN/AR catalog parity, plurals, formatters, rejection copy                                    |   130 | 95 / 95 / 95 / 95                                 |
| `@sarwa/admin`     | View-models, render-only pages, access gates                                                 |   125 | 60 / 49 / 44 / 62                                 |
| `@sarwa/ui`        | DOM primitives, overlays, trading panels, shared Next config and headers                     |    80 | 84 / 66 / 78 / 89                                 |
| `@sarwa/tokens`    | Colour roles, component sizes, generated CSS                                                 |    42 | none                                              |

</details>

- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): format check, lint, typecheck, build, `test:coverage` with the lcov reports uploaded; commitlint on pull requests; a dependency audit.
- **Boundaries lint:** package layering, render-only files, no hex colours outside tokens, all enforced by ESLint ([`packages/eslint-config`](packages/eslint-config)).
- **Commits:** Conventional Commits with fixed scopes (commitlint); Husky runs `lint-staged --max-arg-length 4000` (ESLint fix + Prettier) on pre-commit and commitlint on commit-msg.
- **Bug fixes start with a failing test.**
- **Role checks:** every admin write route requires the ADMIN role (`@Roles(['ADMIN'])`), with VIEWER → 403 tests on the key ones (market, trading, halts, suspend, reveal, export).
- **Live verification on production builds.** A real browser against `next build` + `next start` and the built server, on spare ports with a throwaway database. It caught two production-only bugs that every mocked test missed ([the story](docs/ai/WORKFLOW.md#10-live-verification)).

## How I worked with AI

The whole AI setup is committed. The details, with real examples, are in [docs/ai](docs/ai/README.md); this is the short version.

### 1. Learn first

React Native and a NestJS backend were new to me, so I learned them before building them. Video courses gave me the foundations; then I used AI as a tutor for the gaps, in the context of this project: explaining each concept through what I already know from React on the web, asking "why" until the trade-off was clear, comparing options before choosing, and checking my understanding by explaining it back. I built each part right after learning it, so I could judge every plan and review every diff. That learning shaped concrete choices: FlashList with per-row selectors, Reanimated for animations, pausing the socket only on the AppState background transition, SecureStore for tokens, a default-deny NestJS guard with an optional-customer mode, and Prisma transactions for claiming and merging guest accounts. → [LEARNING.md](docs/ai/LEARNING.md)

### 2. The loop

```mermaid
flowchart LR
  PR["Prompt for a plan"] --> P["AI writes the plan"]
  P --> H["I review, edit and decide"]
  H --> D["Design<br/>brief → written spec"]
  D --> R["Multi-lens review<br/>before build"]
  R --> B["Parallel build<br/>one worktree per agent"]
  B --> G["Gate"]
  G --> V["Live verification"]
  V --> IR["Independent review"]
  IR --> C["Curated commits"]
  G -- red --> B
  V -- bug --> B
  IR -- verified findings --> B
```

Every large piece of work went through this loop; small fixes skipped stages, but nothing skipped the gate. → [WORKFLOW.md](docs/ai/WORKFLOW.md)

### 3. Roles as subagents

The main session is a **coordinator**: it plans, briefs, merges and verifies, and writes no feature code during a parallel wave. Everything else is a role in [`.claude/agents`](.claude/agents):

| Role                               | Job                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Business analyst                   | Studies the domain and how real brokers solve the problem before anything is proposed. |
| Business reviewer                  | Checks flows and copy against the product rules.                                       |
| Architecture reviewer              | Checks structure, boundaries and the shared-logic rule.                                |
| Code reviewer                      | Finds bugs, and verifies each finding before it is reported.                           |
| Security and performance reviewers | Read-only reviews with a fresh context.                                                |
| Implementers                       | One git worktree and branch each, with an explicit list of owned and forbidden files.  |
| Live verifier                      | Drives a real browser against production builds and reports pass/fail with evidence.   |

These role files were distilled from the briefs and rules used during the build; the originals are in [docs/ai/prompts](docs/ai/prompts/index.md).

**Hand-off contracts.** The agent that finishes a layer writes down its public surface: the [client integration guide](docs/ai/prompts/08-client-integration-guide.md) from the core agent and the [server API notes](docs/ai/prompts/09-server-api-notes.md) from the server agent. With those in hand, the web, mobile and admin agents built auth, gating and the customer pages at the same time.

### 4. Guardrails

- **A failing test first** for every bug fix, and **review findings verified** before they are fixed.
- **The gate is the source of truth**, not an agent's report: the coordinator re-runs it after every merge.
- **The human owns decisions, commits and pushes**; rules evolve from real incidents ([LESSONS.md](docs/ai/LESSONS.md)).

The full list, with the reason and an example for each: [BEST-PRACTICES.md](docs/ai/BEST-PRACTICES.md).

## Known limitations

Honest trade-offs for a take-home; most are listed with their reasons in [SECURITY.md](SECURITY.md) and the [ADRs](docs/adr/README.md).

- **Single instance.** Rate limits, the execution queue and socket rooms live in process memory, so the API assumes one process.
- **No real mailer.** Emails are never sent: `LogMailer`, the only `Mailer`, prints each link to the server log as JSON lines with `"context":"Mail"`. A real mailer is on the roadmap.
- **Push notifications:** the server push pipeline exists, but the mobile app does not register for push yet; notifications are delivered in-app and over the socket.
- **Digits setting:** some screens pick up a change of the digits setting only after a refresh.
- **Alerts swipe in RTL:** the swipe on the mobile alerts screen is not mirrored in Arabic yet (the watchlist's is).
- **No Terms or Privacy pages.**
- **SQLite.** Moving to Postgres is a schema change plus a new baseline migration, since the existing migrations are SQLite SQL.
- **`style-src 'unsafe-inline'`** remains in the CSP for inline style attributes (chart geometry, Radix positioning); scripts are nonce-only.
- **No browser end-to-end suite in CI**; production-build checks are run by the live verifier and by hand.

## Roadmap

**Now** (close the known gaps)

- Real mailer behind the existing `Mailer` interface.
- Push notifications on mobile.
- The remaining known limitations above: digits refresh, RTL alerts swipe, Terms and Privacy pages.

**Next** (production readiness)

- Postgres with a baseline migration, and Redis for shared rate limits and the Socket.IO adapter, so the API can scale horizontally (with the execution engine split into its own worker).
- Deploy: web and admin on Vercel, the API on Fly.io or Render.
- Playwright end-to-end tests in CI, promoting the live-verifier flows.
- Two-factor authentication and passkeys (the security screen copy already points to it).
- An observability stack: metrics, tracing and error reporting on top of the existing request ids and JSON logs.

**Later** (product growth)

- A real market-data provider in place of the simulator, feeding the same quote stream.
- Locale in the URL (`/ar/...`) with hreflang, unlocking partial prerendering on the web.
- Storybook for `@sarwa/ui`.

## Repository map and further reading

| Topic              | Document                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture       | [docs/architecture.md](docs/architecture.md)                                                                                                                                                                                                                                                                                                                          |
| Decisions          | [docs/adr/](docs/adr/README.md) (13 ADRs)                                                                                                                                                                                                                                                                                                                             |
| Security           | [SECURITY.md](SECURITY.md)                                                                                                                                                                                                                                                                                                                                            |
| Performance        | [docs/performance.md](docs/performance.md), [Lighthouse scores](docs/performance/lighthouse/README.md)                                                                                                                                                                                                                                                                |
| AI workflow        | [docs/ai/README.md](docs/ai/README.md), [WORKFLOW](docs/ai/WORKFLOW.md), [BEST-PRACTICES](docs/ai/BEST-PRACTICES.md), [LESSONS](docs/ai/LESSONS.md), [LEARNING](docs/ai/LEARNING.md), [prompts](docs/ai/prompts/index.md)                                                                                                                                             |
| Agent setup        | [CLAUDE.md](CLAUDE.md), [.claude/agents](.claude/agents), [.claude/commands](.claude/commands), [.claude/rules](.claude/rules)                                                                                                                                                                                                                                        |
| Manual test script | [docs/ai/prompts/10-manual-test-guide.md](docs/ai/prompts/10-manual-test-guide.md)                                                                                                                                                                                                                                                                                    |
| Apps               | [server](apps/server/README.md) · [web](apps/web/README.md) · [admin](apps/admin/README.md) · [mobile](apps/mobile/README.md)                                                                                                                                                                                                                                         |
| Packages           | [domain](packages/domain/README.md) · [contracts](packages/contracts/README.md) · [core](packages/core/README.md) · [i18n](packages/i18n/README.md) · [tokens](packages/tokens/README.md) · [ui](packages/ui/README.md) · [eslint-config](packages/eslint-config/README.md) · [jest-config](packages/jest-config/README.md) · [tsconfig](packages/tsconfig/README.md) |
| CI                 | [.github/workflows/ci.yml](.github/workflows/ci.yml)                                                                                                                                                                                                                                                                                                                  |
