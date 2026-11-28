# Sarwa Mini Trading: master plan (review → refactor → customer accounts)

This plan comes from five independent reviews (server, shared packages, web, mobile, admin + tooling) done on `main @ dd374ca`, on 2026-11-27. I checked the key findings by hand. Every item says where it lives. **V** means I confirmed it in the code or with curl; **S** means it is suspected and has to be confirmed by a failing test before we fix it.

---

## 0. Working rules (apply to every phase)

**Process**

- Work on a new branch off `main` for each phase. Make small commits; the user commits, and I hand over a `git add` list plus a conventional message (header ≤ 100 characters, scopes from `commitlint.config.mjs`).
- **Every bug fix starts with a failing test.** Every refactor keeps its behaviour, and the tests stay green before and after.
- Never use `prisma migrate reset` or `--force-reset`. Don't commit `.env` or `*.db`. Only stop the user's dev servers with approval.

**Order of changes**

- **Contracts first**: contracts → domain → server → core → apps.
- **Shared-first**: any logic used by two apps moves into `@sarwa/domain` (pure rules) or `@sarwa/core` (hooks, view data). Shared DOM helpers go to `@sarwa/ui`. Apps keep only a view-model hook plus render-only components.

**SOLID, applied to this repo**

- **S:** controllers stay thin. Services own one concern each: orders, execution, notifications and portfolio-reading are separate. No god hooks: `useOrderTicket` gets split.
- **O:** the API client, socket and storage are configured through injected providers (auth slot, `KeyValueStorage`, `Mailer`, `PushSender`, `Clock`, `Random`). Adding auth must not mean editing every call site.
- **L:** both `KeyValueStorage` implementations (Async and Secure) and both push and mail senders behave the same way under the same tests.
- **I:** split `ApiClient` (27 methods) into Market, Watchlist, Trading, Alerts and Notifications APIs, then compose them into one.
- **D:** services depend on abstractions (an event bus instead of gateways, a `Mailer`, a `Clock`, a `Random`).

**Clean code**

- Intention-revealing names, small functions, and no dead code (delete `SECTOR_LABELS`, the unused `insufficient_funds_at_open`, and the `/settings` duplicate on mobile, or justify keeping them).
- Minimal comments: a one-line _why_ only. No magic strings: routes, events and error codes come from contracts.

**Security baseline**

- Default-deny auth with explicit `@Public()`.
- Validate every input (body, query, params).
- Mask PII by role, enforced on the server.
- Security headers and a CSP on every app.
- Audit every admin and customer security action.

**Performance budgets**

- No per-row N+1 queries and no interactive transaction per account in list endpoints.
- The admin list stays under 1 s at 300+ accounts.
- A live tick re-renders only the changed row.
- Web: no layout shift from JS-decided layouts. Fonts are preloaded only where needed.

**Responsive**

- Check at 360, 768, 1024 and 1280 px.
- Choose layouts with CSS breakpoints, not `useMediaQuery` (JS is fine only for behaviour).
- Tables get a stacked-row fallback below `md`.

**SEO**

- Public pages (home or landing, markets, stock pages) are indexable, with canonical URLs, Open Graph images, JSON-LD and a sitemap.
- Personal pages are `noindex`. Unknown symbols return a real 404.

---

## Phase 0: delivery blockers and quick wins

Start now, while the design is being made.

### 0.1 Critical server fixes

| #   | Item                                                                                                                                                                                                                                                     | Where                                                                             | Status |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------ |
| 1   | `/admin/accounts` returns 500. Replace the per-account `books()` transaction with a **batched `PortfolioReader`**: about 5 plain queries for every account, valued in memory, then sorted and paged. Test: seed 300+ accounts and expect a 200 in < 1 s. | `trading/admin-accounts.service.ts:41-78`, `portfolio.service.ts:65-135`          | V      |
| 2   | The snapshot job and the equity history use the same batched reader. Use `createMany`, downsample `1Y`/`ALL` in SQL, and add a retention job.                                                                                                            | `portfolio.service.ts:170-209`                                                    | V      |
| 3   | Order stats use `groupBy` and counts in SQL instead of loading every order.                                                                                                                                                                              | `admin-trading.controller.ts:196-233`                                             | V      |
| 4   | Add indexes `Order @@index([status, expiresAt])` and `Fill @@index([accountId, epoch, at])` in a new migration.                                                                                                                                          | `schema.prisma`                                                                   | V      |
| 5   | Notification fan-out (halts, early close) does `createMany` inside the queue task, then emits and pushes after it, outside the queue.                                                                                                                    | `notifications.service.ts:29-42`, `halts.service.ts`, `engine.service.ts:185-194` | V      |

### 0.2 Security quick wins

| #   | Item                                                                                                                                                                                                             | Where                                                   | Status |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------ |
| 1   | Audit log: VIEWER gets **masked emails and IPs** (decision Q3). Add an e2e test.                                                                                                                                 | `admin/admin.controller.ts:111`, `audit.service.ts`     | V      |
| 2   | Map Prisma P2003 to 409 (stock delete race).                                                                                                                                                                     | `common/problem-details.filter.ts`                      | V      |
| 3   | Zod-validate `@Query('q')` and `@Param('id')` everywhere.                                                                                                                                                        | `stocks.controller.ts:20`, `users.controller.ts:81`, …  | V      |
| 4   | Seed refuses the default passwords when `NODE_ENV=production`.                                                                                                                                                   | `prisma/seed.ts:66,72`                                  | V      |
| 5   | Add `TRUST_PROXY` to env. Fail fast on a weak `JWT_SECRET` in production.                                                                                                                                        | `main.ts:15`, `env.ts`                                  | V      |
| 6   | Web and admin: `poweredByHeader:false`; headers for HSTS, nosniff, Referrer-Policy, `frame-ancestors 'none'` and Permissions-Policy. Admin also gets `X-Robots-Tag: noindex` and `app/robots.ts` (disallow all). | `apps/web/next.config.ts`, `apps/admin/next.config.ts`  | V      |
| 7   | Admin JWT: add an `aud:'admin'` claim and a `tokenVersion` check, so logout and disabling revoke immediately. Audit `auth.logout` and `auth.login_failed`. Add a per-email lockout.                              | `admin/auth.controller.ts:49-92`, `admin/auth.ts:43-65` | V      |
| 8   | Mobile: throw in release builds when the API URL is missing or not https. Set `android.allowBackup: false`.                                                                                                      | `apps/mobile/src/lib/client.ts:16-22`, `app.json`       | V      |

### 0.3 Correctness

| #   | Item                                                                                                                                                                | Where                                                                      | Status   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| 1   | Mobile shows "Canceled by you" for admin resets. Fixed by the shared order copy (Phase 1.3); start with a failing test per `cancelReason`.                          | `apps/mobile/src/features/orders/order-copy.ts:51`, `order-timeline.ts:61` | V        |
| 2   | Disabling a stock cancels its working orders through the queue, with a `cancelReason` (`symbol_disabled`), so their holds are released.                             | `admin/stocks-admin.controller.ts:77`                                      | V        |
| 3   | Modifying an order keeps the original `expiresAt`.                                                                                                                  | `trading/orders.service.ts:241`                                            | V        |
| 4   | Account reset sends `account.reset` to that account's room so open clients resync. Halt auto-resume is audited as `system`.                                         | `admin-accounts.service.ts:113`, `halts.service.ts`                        | V        |
| 5   | Kill switch: **keep the current behaviour** (it blocks new orders only; resting orders keep working). It is a documented business decision; write it in the README. | `engine.service.ts:117`                                                    | decision |

### 0.4 Tooling and CI

- `turbo.json`:
  - `build.env` lists `API_URL`, `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*` and `GIT_SHA`.
  - `test.env` lists `DATABASE_URL` and `JWT_SECRET`.
  - `test.outputs` is `["coverage/**"]`.
  - `inputs` exclude docs.
- CI:
  - One `turbo run lint typecheck test build` plus `actions/cache` for `.turbo`.
  - `GIT_SHA: ${{ github.sha }}`.
  - Mobile typed-routes generation before `tsc`. Test it by deleting `.expo/` and running typecheck.
  - `concurrency` cancels only on PRs.
  - Actions pinned by SHA, plus `dependabot.yml`.
- `engines.node` is `22.x`.
- Coverage floors in ui and the apps.
- `knip` (or similar) for dead exports.
- One smoke job:
  - Boot the server with the test DB and run admin `next start`.
  - Fetch through the rewrite: login → `/me` → a VIEWER mutation gets 403 → the socket connects.

### 0.5 Docs and AI setup (required by the take-home)

- `README.md`:
  1. What it is, with screenshots.
  2. Quick start (Node 22, corepack, `pnpm i`, `pnpm dev`, ports, demo logins).
  3. Phone via Expo Go.
  4. Env table and the per-app `.env.example` files (web `NEXT_PUBLIC_API_URL`, admin `API_URL`, mobile `EXPO_PUBLIC_API_URL`).
  5. Scripts.
  6. Architecture diagram and layering rules.
  7. Key decisions, linked to ADRs.
  8. Testing strategy.
  9. Workflow (branches, commits, hooks, CI).
  10. AI-assisted workflow.
  11. Security notes.
  12. Known limitations and next steps (single instance, device identity until accounts, locale-in-URL + PPR, push).
  13. License.
- `CLAUDE.md`:
  - Commands for each workspace.
  - Architecture rules (shared-first, view-model hooks, contracts-first, tokens only).
  - Next 16 docs location.
  - Conventions (minimal comments, i18n for every string, a11y labels).
  - Commit rules, test rules (failing test first; a VIEWER-403 test for every gated route).
  - Do/don't list (no `.env`, no `*.db`, no `migrate reset`).
- `.claude/`:
  - `settings.json` with allow and deny lists, and hooks (format on edit; affected lint/typecheck on stop).
  - Commands: `/verify`, `/contract-change`, `/new-screen`, `/commit-msg`.
  - Agents: `reviewer` and `test-writer`.
  - `settings.local.json` stays git-ignored.
- `docs/adr/`:
  - Monorepo.
  - Shared core with view-model hooks.
  - Zod contracts.
  - Integer money.
  - Execution queue and single instance.
  - Socket snapshot + stream + seq.
  - Web SSR snapshot.
  - Admin cookie auth via rewrites.
  - SQLite + Prisma.
  - No browser e2e, with the smoke job instead.
  - Customer accounts model.
  - i18n and RTL.
- Also: `SECURITY.md`, `LICENSE` (or a "proprietary take-home" note), a PR template, and an accessibility statement (WCAG 2.2 AA target, with what was tested).

---

## Phase 1: shared-code consolidation (DRY), before auth

### 1.1 contracts

- `MARKET_ROUTES` covers stocks, stock, candles, watchlist, watchlistItem, appConfig and health. Use `routePath` everywhere: `core/api.ts:237-244`, `core/admin/api.ts:135-138`, `web/lib/server-api.ts:21-30`.
- Typed `ErrorCode` enum in `ProblemSchema` and the subscribe ack, plus one `isApiError(e, code)`. Retire `isNotFound`, `isUnauthorized` and `isConflict`.
- Use the socket event-name constants everywhere (`core/market-socket.ts:146-221`). Move `AdminTradingEventSchema` into contracts.
- Delete `SECTOR_LABELS`, and decide what to do with `insufficient_funds_at_open`.

### 1.2 domain

- Add `orderRealizedCents`, `remainingAmountCents` and `todayActivity(fills, position)`; the last one moves out of `portfolio.service.ts:100-117`.
- Holds come only from the domain. Remove `execution.service.ts:130 reservedCents`.

### 1.3 core: new shared view logic (pure functions taking `{t,f}` and returning view data)

| New module                                                                                                                               | Replaces                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orders-copy.ts` (type label, size label, note, time, timeline, fillProgress, isCancellable = !isTerminal)                               | web `features/orders/order-copy.ts` + `use-order-drawer.ts:21-118`; mobile `features/orders/order-copy.ts` + `order-timeline.ts` + `use-order-detail-screen.ts:28-44` |
| `ticket-copy.ts` (`ticketEntryView`, `ticketReviewView`)                                                                                 | web `features/trade/ticket-copy.ts`; mobile `order-ticket/ticket-entry-model.ts` + `ticket-review-model.ts`                                                           |
| `alerts.ts` (`alertState`, `alertDetail`, `alertRequest`) + `useAlertForm`                                                               | web `use-alerts-page.ts:21`, `use-alert-dialog.ts:25`; mobile `use-alerts-screen.ts:25`, `use-create-alert.ts:28`                                                     |
| `markets.ts` (`topMovers`, `heatmapTiles`)                                                                                               | web and mobile `use-home-*.ts:29`; mobile search importing from home                                                                                                  |
| `notifications.ts` (`notificationRows`, a platform-neutral target `{kind, orderId?, symbol?}`)                                           | web `use-notification-center.ts:18-38`; mobile `notification-copy.ts:26-40` (also fixes the drift)                                                                    |
| Hooks: `useNow`, `useCountdown`, `useQuotes(symbols)`, `useStoredList`, `useDebouncedValue`, `useStockIndex`                             | `core/hooks/order-ticket.ts:44`, `mobile/lib/clock.ts`, `core/admin/session.ts:37`, `core/admin/catalog.ts:104`, `mobile/lib/sectors.ts`                              |
| `createSarwaClient({apiUrl, storage, randomUUID, transports, auth})`                                                                     | three hand-built clients: `web/lib/client.ts`, `mobile/lib/client.ts`, `admin/lib/client.ts`                                                                          |
| `createRequest({baseUrl, auth:{headers, credentials, onUnauthorized}})`, used by both the customer and admin clients. One `queryString`. | `core/api.ts`, `core/admin/api.ts:89-125` (removes the cast wrapper)                                                                                                  |
| ISP split of `ApiClient` into Market, Watchlist, Trading, Alerts and Notifications APIs, composed back into one                          | `core/api.ts:181-210`                                                                                                                                                 |
| Split `useOrderTicket` (239 lines) into `useFrozenQuote`, form, validation and submit                                                    | `core/hooks/order-ticket.ts`                                                                                                                                          |

- Fix: `useChartSeries` memoizes the history geometry and patches only the last point on each tick (`core/hooks/market.ts:65-67`).

### 1.4 i18n

- `f.currencyAffix()` and `f.digits()` replace the 7 hard-coded `'$'` (web `ticket-entry.tsx:70,100`, `order-drawer.tsx:144`, `alert-dialog.tsx:93`; mobile `ticket-entry-model.ts:120,140`, `use-create-alert.ts:74`, `order-detail-screen.tsx:143`; admin `stock-dialog.tsx:128`) and mobile `localDigits`.
- The admin catalog becomes a separate `getAdminMessages`. `haltDurationLabel` moves to `core/admin`.
- Move the shared `notFound` and paper-account keys and the mobile `route-fallbacks.tsx` English into i18n.

### 1.5 ui (DOM-shared)

- Move `theme.ts`, `usePageLifecycle`, `useLocalPreference`, `safeLocalStorage` and `toCsv`/`downloadCsv` out of web and admin (web `lib/theme.ts`, `lib/browser.ts`, `lib/csv.ts`; admin `lib/theme.ts`, `lib/browser.ts`).
- `Table` gets a built-in `overflow-x-auto` wrapper.
- Move pure helpers to `@sarwa/core/pure` so ui doesn't import the React Query layer (`change-pill.tsx:1`, `sparkline.tsx:1`).
- Mobile components take a `label` prop and stay render-only (`star-button.tsx`, `connection-badge`). Align names (`SideToggle`) and use domain `Side`.

### 1.6 Lint and tsconfig guards

- App `use*.ts` files can't import `@tanstack/react-query` or `useSarwa` directly (mobile `use-search-screen.ts` violates this today).
- Web and mobile can't import `@sarwa/core/admin`.
- `core/server.ts` can't import React or hooks.
- Add a `pure.json` tsconfig (no DOM) for domain, contracts and i18n. Consider `exactOptionalPropertyTypes`.

---

## Phase 2: server architecture, before auth

1. **Principal abstraction:** a guard resolves `Principal {accountId, userId?, deviceId?}`, read with `@CurrentAccount()`. Services take `accountId`. Remove `AccountPipe` and `DeviceAccount`, and **stop creating accounts on GET**; until auth ships, only an explicit first write creates one (`orders.controller.ts:43-53`, `accounts.service.ts:29-70`).
2. **Rooms keyed by account:** use `acct:<accountId>` (and `user:<userId>` later). Gateways take an `accountId`, which deletes the `AccountsService.refs` cache. Auth moves into handshake middleware (`trading.gateway.ts:17-39`).
3. **Ownership:** WatchlistItem and PushToken move to Account. `halts.affectedAccounts` stops joining through Device (`halts.service.ts:104-122`).
4. **Domain events (SRP/DIP):** `ExecutionService` publishes `order.changed` and `alert.fired` on an event bus. The gateways, admin feed and notifications subscribe. TradingModule no longer imports AdminModule (`execution.service.ts:56-67,120-127`).
5. **Thin controllers:** add `AdminOrdersService`, `AdminUsersService`, `StocksAdminService`, `HaltsService.adminHalt` and `AdminAuthService` (`admin-trading.controller.ts`, `users.controller.ts`, `stocks-admin.controller.ts`, `admin.controller.ts`, `auth.controller.ts`).
6. **DRY:** one shared `IdParam`. One `WritableGuard`, removing the duplicate maintenance check in `watchlist.service.ts:45-49`.
7. **Inject `Random`** like `Clock` (`execution.service.ts:57`, `market.service.ts`).
8. **Ops:**
   - Split health into `/health/live` and `/health/ready`; ready checks the DB and that the engine is loaded.
   - Structured logs with `nestjs-pino`, a request id, and redaction of cookies, auth headers and passwords.
   - Push sender gets `AbortSignal.timeout` and chunks of 100.
9. **Single-instance contract:** the README and an ADR say the engine runs as one instance. The way out is to split the API from the engine and use the Redis adapter plus Redis throttler storage.

---

## Phase 3: platform fixes, web, mobile and admin

### 3.1 Web

- **Same-origin API:** rewrites for `/api` and `/socket.io` (copy from admin). The browser client uses a relative base, and `API_URL` stays server-only. Required for the auth cookie.
- **`server-api.ts`:** public fetchers stay cached and send no cookie, with a test for that. Personal fetchers are `no-store` and forward the cookie.
- **Route groups:** `(public)` for home, markets and stocks; `(auth)`; `(account)`, whose layout sets noindex and does a server session check. `proxy.ts` is only for optimistic redirects, and `next` is validated (the same `safeNext` logic, shared).
- **SEO:**
  1. `metadataBase`, OG and Twitter cards. Add `opengraph-image.tsx` for the root and for each stock (no price on it).
  2. `robots.ts` and `sitemap.ts`, built from `getStocks()`.
  3. Canonical URLs. `/stocks/aapl` gets a `permanentRedirect` to `/AAPL`, and `/markets` is canonical without query params.
  4. Unknown or removed symbols call `notFound()` and get a real 404 page (today `/stocks/ZZZZZ` returns 200).
  5. JSON-LD: Organization and WebSite (with a SearchAction), plus BreadcrumbList and the stock entity.
  6. Titles localized from the cookie now. hreflang comes with locale-in-URL later.
  7. Price-free stock descriptions.
  8. The public landing gets a real h1 (decision Q4).
  9. Heatmap tiles become links.
  10. Maintenance returns 503 from the server.
- **Responsive:**
  - The order panel and markets preview are chosen with CSS, not `useMediaQuery` (`use-order-panel.ts:120-122`, `use-markets-page.ts:38-43`).
  - Tables (orders, positions, alerts) get a stacked-row variant below `md`.
  - Heatmap columns: 3 on phones, 4 at `sm`, 6 at `md`.
  - The mobile nav gets a scroll hint and a status dot.
- **Performance:**
  - Font preload only for Inter, Manrope trimmed to its weights, and Arabic/Mono not preloaded.
  - Add `loading.tsx` for the main routes and `global-error.tsx`.
  - The stock page is split into an RSC static part and client islands (also needed for JSON-LD and later PPR).
  - Home movers and heatmap are derived from live quotes, throttled.
- **Security:** CSP with a nonce via `proxy.ts` (covers the inline theme script and limits `connect-src`); the preference cookie gets `secure` on https.
- **A11y:**
  - Sector chips become `aria-pressed` buttons.
  - Watchlist and orders rows use a stretched link instead of a `tr tabIndex`. Use `aria-current` instead of `aria-selected`.
  - Chart gets `role="status"`.

### 3.2 Mobile

- **Identity:** `expo-secure-store` behind `KeyValueStorage`, so `createIdentity` returns `{deviceId, token?}`.
- **Persisted cache:**
  - Persist an allow-list only (stocks, app-config, trading status, watchlist, first portfolio page). No candles, order pages or preferences.
  - The key includes the identity.
- **Routing:**
  - `unstable_settings.initialRouteName='(tabs)'`, with a back fallback.
  - Rename `stock/[symbol]` to `stocks/[symbol]` to match the web.
  - Share links use https web URLs.
  - Add `associatedDomains` and `intentFilters`, with AASA and assetlinks served by the web.
  - Validate the deep-link `symbol` param.
- **Maintenance:** becomes an overlay that keeps `(auth)` reachable, is i18n'd, and ignores a persisted flag until the app refetches.
- **Performance and startup:**
  - Embed the fonts through the `expo-font` plugin.
  - Narrow `usePortfolio` selectors on the stock detail screen.
  - FlashList v2 for orders and notifications.
  - A stable `onViewableItemsChanged`.
- **Lifecycle:** only `background` pauses the socket (iOS `inactive` should not). One NetInfo source.
- **A11y:**
  - The watchlist row gets a `remove` accessibility action.
  - The swipe direction is mirrored in RTL.
  - Hit targets are at least 44 pt (sector chips, period tabs).
- **Store readiness:** `eas.json`, versionCode/buildNumber, `ITSAppUsesNonExemptEncryption:false`, a privacy manifest and an app description.

### 3.3 Admin

- The sidebar becomes an off-canvas drawer below `lg`, with `px-4 md:px-8`.
- Table scroll comes from the ui `Table`.
- Filters, sort and page are synced to `searchParams` (`use-accounts-page.ts`, `use-audit-page.ts`).
- CORS for `/admin/*` is limited to same-origin. Mutations check `Origin`.
- Tests render through a fake client or MSW at the HTTP edge instead of mocking hooks. Add tests for the overview and the shell.

---

## Phase 4: customer accounts (after the Claude Design boards)

The business model is in `memory/customer-accounts-plan.md` and the design brief in `03-design-accounts-and-auth.md`.

**Server**

- Prisma:
  - `User`: email unique and lower-case, bcrypt cost 12, status, `emailVerifiedAt`, `failedLogins`, `lockedUntil`.
  - `Session`: `refreshHash`, `familyId`, ip, ua, `lastUsedAt`, `expiresAt`, `revokedAt`.
  - `PasswordResetToken` and `EmailVerificationToken`, both hashed and single-use.
  - `Account.userId` unique, with `deviceId` nullable.
- `AuthModule`: sign-up, sign-in, refresh, sign-out, sign-out-all, forgot, reset, verify, `me` and sessions.
- Tokens:
  - Access JWT lasts 15 minutes, with `aud:'customer'` and a `sid` claim.
  - Refresh tokens are opaque and rotate, with reuse detection that revokes the whole family.
  - Web: the refresh token is an httpOnly, Secure, SameSite=Lax cookie on path `/api/auth`, plus an Origin check.
  - Mobile: bearer token stored in SecureStore.
- A global default-deny guard with `@Public()` on stocks, candles, app-config, trading status and health.
- Abuse protection:
  - Per-IP throttles.
  - Per-email lockout with backoff.
  - Generic responses.
  - Audit `customer.*` events.
- `Mailer` abstraction: `LogMailer` in dev and test, one real provider later.
- Guest claim:
  - On sign-up, attach the device's paper account in one queued transaction.
  - On sign-in, discard the device data after a warning.
  - Never merge two portfolios.
- Admin Customers:
  - A paginated SQL list (built on the batched `PortfolioReader`) with masked PII for VIEWER.
  - Suspend: set the status, revoke sessions, disconnect the `user:` room, then a choice that has to be made: cancel or keep working orders.
  - Sign out all, send a reset email, reset the paper account.
  - Everything is audited with before and after values.

**Core**

- A `SessionStore` (zustand) holding `{status, user}` and a `TokenStorage` adapter.
- Hooks: `useSession`, `useSignIn`, `useSignUp`, `useSignOut` and `useRequireAuth(intent)`, which returns `run(action)` and opens the gate.
- The `createRequest` auth slot does one refresh on a 401, then falls back to guest.
- `market.reauthenticate()` runs when the identity changes.
- Query keys: public keys stay global, private keys go under `['me', userId, …]`. On identity change call `removeQueries(['me'])` (not `clear()`, which wipes preferences), remove the persister client, and resync.

**Web**

- `(auth)` pages, an auth modal for gated actions, guest empty states and the guest top bar.
- `/` is a public landing page for guests and the dashboard once signed in (decision Q4).

**Mobile**

- An `(auth)` group, plus `Stack.Protected` around `order/new`, `orders`, `alerts` and `notifications`.
- One root `AuthGateSheet`.
- The Account tab shows a welcome screen for guests.
- Push: `expo-notifications`. Register the token after sign-in, delete it on sign-out, and route a tap through the shared notification target.

**Admin**

- The Customers list and detail pages (from the design).
- The "Users" page is renamed "Team".
- Update the Overview and Audit chips.

**Tests**

- Refresh rotation and reuse detection.
- Lockout.
- A suspended user dropped from sockets.
- Cross-account access returns 404.
- The claim and discard paths.
- VIEWER masking.
- Identity change clears the private cache.
- A guest cannot reach personal endpoints.

---

## Phase 5: verification and handoff

- Run the full gate: format, lint, typecheck and test for all 34 tasks, plus the build. Then the smoke job, then load tests (300+ accounts, an equity query over many snapshots, fills during an admin list).
- Manual checks:
  - Responsive at 360, 768, 1024 and 1280 px.
  - Lighthouse SEO and a11y on `/`, `/markets` and `/stocks/AAPL`.
  - Robots, the sitemap and 404 status codes.
  - Mobile on the emulator, and the user's phone.
  - Arabic RTL everywhere.
- Update the README and ADRs.

## Decisions already taken (don't re-open)

- **Web rendering:** SSR snapshot + stream with a 5 s cache. Locale-in-URL and PPR come later.
- **Kill switch:** blocks new orders only.
- **Status codes:** 400 for validation, 201 for business rejections, 200 for an idempotent replay, 422 for a mismatch.
- **Testing:** no browser e2e suite; a smoke job takes its place.
- **Customers:** create their own accounts; admins manage them but never create them.

## User decisions (2026-11-27)

### Q1: when to start

**Nothing starts until Claude Design finishes the accounts boards.** Then every phase runs with the full picture.

The README, CLAUDE.md, `.claude/`, ADRs and the AI-setup items (Phase 0.5) come **last, and only when the user asks for them**, after everything else is done correctly. Keep every 0.5 item in this plan; don't drop any.

Execution order once the design is ready: 0.1–0.4 → 1 → 2 → 3 → 4 → 5, with 0.5 (docs) at the very end when requested.

### Q2: guest watchlist

The watchlist **requires an account** (Robinhood model). For a guest, the ⭐ opens the auth gate. No local guest watchlist and no merge.

### Q3: VIEWER and PII

The user asked for the best business solution. Decided:

- **Role-aware PII policy, enforced on the server, in one place.**
  - A `PiiPolicy` (or a serializer per role) masks emails (`m•••@gmail.com`) and IPs (`192.168.•.•`) for VIEWER in every admin response: audit, customers, orders, accounts.
  - ADMIN sees full values.
  - The client never receives the raw PII, so the UI can't leak it.
- **VIEWER can still open Audit and Customers**, masked, so they can do their job.
- **Revealing full PII** for a specific customer is an ADMIN-only action, and the reveal itself is audited (`customer.pii_viewed`).
- The mask helpers (`maskEmail`, `maskIp`) are pure and live in one shared place, with unit tests. The policy is applied in the server mapping layer, not in controllers (SRP).
- Data minimization:
  - The audit log keeps IPs for a retention window (e.g. 90 days), then a job truncates or anonymizes them. Document this.
  - Exports (CSV) of customer data are ADMIN-only and audited.

### Q4: guest landing

Use the best solution, and **web and mobile must match.**

- **Guest:** `/` on web and the Home tab on mobile are a public landing. It shows a hero ("Practice trading US stocks with $100,000 virtual cash"), the Create account / Sign in buttons, live top movers, the sector heatmap and a "how it works" section in 3 steps. Indexable on web, with SEO h1 and JSON-LD.
- **Signed in:** the same route shows the personal dashboard (equity, buying power, open orders, alerts, activity, movers, heatmap), the same on both platforms.
- The switch comes from the session in `@sarwa/core` (`useSession`). The landing and dashboard view-models live in core: one `useHomeView()` returns `{mode:'guest'|'member', …}`, and each app renders it. On web the signed-in dashboard is `noindex`-safe: SSR renders the guest landing for crawlers, and personal data loads client-side.
