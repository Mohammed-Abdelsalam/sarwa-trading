# Task: Close everything still open after Trading v2 — sarwa-trading

An independent session reviewed your work while you built Trading v2, and verified the final tree after you finished. Every item below is **still open in the current working tree**: I checked each one by grepping the code or running it. Items you already fixed have been removed from this list.

## How to work

- Repo: `sarwa-trading`. Run pnpm and node through **PowerShell**.
- One pass. **Don't commit, push or revert.** Keep your earlier commit plan and extend it.
- **Language:** code and commit messages are in English.
- **Architecture:**
  - Pure rules live in `@sarwa/domain`.
  - Client logic lives in `@sarwa/core`; apps import from core only.
  - Apps are a view-model hook plus render-only UI.
  - `@sarwa/ui` is presentational.
- Keep it simple; one-line comments only.
- **Every bug fix needs a test that fails before the fix.**
- Use subagents for independent parts if you like, then integrate and run the full gate yourself.

---

## A. Money correctness (highest priority)

### A1. The domain still lets a buy drive cash negative, and no test covers the server guard

**Reproduced again on the final tree:**

1. A buy **stop** at $105, sized to the full buying power (hold 9,922,500¢ = stop + 5%).
2. The price gaps to $120.
3. `applyFill` gives `cashCents = −806,309` (**−$8,063**).

The server guard in `apps/server/src/trading/execution.service.ts` (`fill`, the `INSUFFICIENT_FUNDS` branch) prevents this in the engine. **But there is no test for it**: grepping `apps/server/test` finds no gap test.

**Fix:**

- **Domain:** make negative cash impossible. `applyFill` throws `IllegalFillError` when a buy would take cash below 0. Optionally add a pure `affordableMicros(cash, otherHolds, price)` that the server uses to cap the quantity.
- **Server e2e tests**, each asserting the order is `rejected` with `INSUFFICIENT_FUNDS` (or capped), and that `cash ≥ 0` and `cash − holds ≥ 0`:
  1. a buy stop gapping 15% past its stop
  2. a share-sized market buy filled on a later tick after the ask moved more than `maxSlippageBps`
  3. a queued market buy whose open gaps beyond `closedMarketBufferBps`
- **Property test:** extend `books (property)` in `packages/domain/test/execution.test.ts` to also generate **market and stop orders and random gaps up to ±25%**. Today it only generates limit orders, which can never fill above their limit; that is why it missed this.
- Add a unit test that the engine skips a zero fill quantity (`fillQuantity` returns 0 when the displayed size is 0).

### A2. An admin halt leaves stale prices in the breaker window

`CircuitBreaker` clears a symbol's window only when the breaker itself trips (`circuit-breaker.ts`). An **admin** halt doesn't clear it. Prices keep streaming during the halt without being sampled, so the first print after resume is compared with pre-halt prices and can trip a false halt.

- Clear the window on every halt start and resume, called from `HaltsService`.
- Tests:
  - admin halt, then a move of more than 10% while halted, then resume: no auto-halt
  - breaker trip, then resume after `haltMs`: the next normal tick doesn't re-halt

### A3. `prevClose` falls back to `basePrice` after a restart

`schema.prisma` persists `lastTicks` only. After a restart the "today" change, today's P&L, `% move today` alerts and the breaker reference are wrong until the next rollover.

- Persist `prevCloseTicks` and `openTicks` (and the day's high and low if cheap), restore them on boot.
- Test: restart the app in a test, and the change % is unchanged.

---

## B. Contracts and client correctness

### B1. Contract schemas aren't tied to domain types

`RejectionSchema`, `ExecutionRulesSchema` and `CircuitBreakerSchema` in `packages/contracts/src` are hand copies of the domain types. Grepping finds no `satisfies` or `ZodType<` anywhere.

- Add a compile-time check per schema, e.g.
  ```ts
  type _ = Expect<Equal<z.infer<typeof RejectionSchema>, Rejection>>;
  ```
  or `satisfies z.ZodType<Rejection>`.
- Then a new domain rejection code without a contract update fails `typecheck`.

### B2. Routes and response shapes aren't shared

The paths (`/orders/:id/cancel`, `/notifications/read-all`, `/push-tokens`, …) are string literals in both `apps/server` controllers and `packages/core/src/api.ts`. They were aligned by message during the build, not by code. Alert create and update return a bare `Alert` with no response schema.

- Add one `TRADING_ROUTES` (and admin routes) constant set to `@sarwa/contracts`, and use it on both sides.
- Add response schemas for every endpoint that lacks one, and parse every response with them in core.
- Add one e2e test per device endpoint, parsing the real server response with the schema the client uses.

### B3. Rejections are handled two ways

`packages/core/src/hooks/orders.ts` (`rejectionCodeOf`) handles both the stored `rejected` order (201) and a 4xx problem whose `code` is a rejection code.

- Keep one way for business rejections: the 201 stored order.
- Keep 4xx only for request validation and idempotency errors.
- Document this in the README and delete the dead branch.

### B4. No order or notification pagination

- `useOrders` loads only the first page, and there is no `useInfiniteQuery` in core.
- The server caps notifications at 100 (`notifications.service.ts`) with no cursor.
- Add cursor pagination to notifications (same shape as orders).
- Use `useInfiniteQuery` for both, with "Load more" on web and infinite scroll on mobile.

### B5. The ticket assumes trading is enabled while the status loads

`packages/core/src/hooks/order-ticket.ts` falls back to `tradingEnabled: status?.tradingEnabled ?? true` and `DEFAULT_EXECUTION_RULES`. So Buy/Sell looks enabled before the status loads, even if trading is off or the symbol is halted.

- Treat "status not loaded" as a neutral block reason ("Loading…" on the button).
- Prefetch the status at app start (web SSR, mobile boot).

### B6. Contracts coverage is 73.4% statements

Measured just now: 59 tests, unchanged since Phase 2, although many schemas were added since.

- Add parse tests (valid, plus the main invalid cases) for every trading, admin-trading and socket schema.
- Target ≥ 95%.

---

## C. Type safety of units

### C1. `Cents`, `Ticks`, `Micros` and `Bps` are plain `number`

Passing cents where ticks are expected compiles. That's the most likely bug class in a money codebase.

- Brand them in `packages/domain/src/money.ts`, e.g. `type Cents = number & { readonly __unit: 'cents' }`.
- Create values only through the existing conversions and constructors.
- No runtime cost, no classes.
- Fix what the compiler finds, and **list every real mismatch it caught** in the report.

---

## D. i18n and UI

### D1. Two formatters still exist

- `packages/core/src/format.ts` still builds its own `Intl.NumberFormat('en-US', …)`.
- The Phase 1 screens still call `formatPrice` and friends, e.g. `apps/mobile/src/features/stock-detail/price-header.tsx` and `range-card.tsx`.
- In Arabic, these screens show English digits and formats, while v2 screens follow the locale.
- **Fix:** make core's format helpers thin wrappers over the `@sarwa/i18n` formatter for the active locale, or migrate their callers. Then delete the duplicated `Intl` setup.

### D2. Phase 1 screens are English-only

In Arabic, Markets, Watchlist, stock detail and the sort labels in core are still English, on web and mobile.

- Move their copy into `@sarwa/i18n` (en + ar) and use `t`.
- Review `apps/web/src/lib/messages.ts` (193 lines): anything not truly web-only moves to `@sarwa/i18n`.

### D3. The i18n param formatting is guessed by regex, with an `as` cast

`packages/i18n/src/rejections.ts` picks a formatter by `/Ticks$/`, `/Cents$/`, … on the key name, then casts.

- Replace it with a typed per-code map the compiler checks.
- Cache one formatter per `(locale, digits)`; today a new one is built per message.

### D4. Small UI kit leftovers

- `packages/ui/src/trading/connection-badge.tsx:19` still uses `pl-`/`pr-`. Switch to `ps-`/`pe-` for RTL.
- `StatusBadge` takes `status: string` (`status-badge.tsx:34`). Type it with `OrderStatus | 'sending'` and the alert statuses, and make the tone maps `Record<…>`, so a typo can't silently fall back to neutral.

---

## E. E2E honesty

### E1. Web trading specs still skip depending on the market

`apps/web/e2e/trading.spec.ts:28`, `:114` and `:139` call `test.skip` based on whether the market is open. The suite can pass while testing nothing.

- Make the e2e setup deterministic through the admin API in `globalSetup`:
  - `sessionMode = always-open` for the open-market specs
  - `calendar` with a fixed clock (or a test-only session override) for the queued spec
  - the breaker off
  - slippage 0
- Remove the skips. Assert exactly one outcome per spec.

---

## M. Mobile

### M1. The mobile app has never been run

Only jest ran.

- Run it (Expo Go, emulator or simulator) against the real server. Walk through:
  - buy $500 → filled → portfolio
  - a limit order → cancel
  - create an alert
  - notifications → mark all read
  - switch to Arabic and check RTL: tab order, chevrons, sheets, keypad
- Fix what breaks.
- Add a Maestro flow for buy → filled if it is cheap; otherwise list the manual checks in the README.

### M2. Push on mobile

`expo-notifications` isn't installed, so tokens are never registered and the Push switch is a disabled control.

- **Either** implement it (permission at alert creation, `POST /push-tokens`, the switch enabled),
- **or** remove the switch and document "in-app only".

### M3. Rule consistency between web and mobile

- **% move alerts:** confirm mobile supports **negative** thresholds (down moves), as the domain and contracts do.
- **Spread %:** compute it once in core (choose mid or last, documented) and use it on both platforms.
- **Slippage:** mobile computes it in `use-order-ticket-screen.ts` (~line 194). Move it into core's ticket result as `slippageBps` **and** `slippageCents`, and show "+$0.02 slippage" as in the design.

### M4. Sizes without tokens

Keypad digits are 20px instead of 24, and Home equity overrides `display` to 34px.

- Add the type tokens to `@sarwa/tokens` and use them.

---

## F. Admin

### F1. A fake version string

`apps/admin/src/components/layout/sidebar.tsx:10` falls back to the hard-coded "v1.4.2 · local".

- Expose the real server version (`package.json` version and the git sha) from `/health` or `/admin/stats`, and show it.
- Or remove the card.

---

## R. README (missing entirely)

**There is no `README.md` at the repo root.** For a take-home, that is the first thing a reviewer opens. Write one, concise and skimmable, with:

1. **What it is and how to run it:**
   - the prerequisites
   - `pnpm install`
   - `pnpm dev` (ports: API 4000, web 3000, admin 3001, Expo)
   - the seeded admin and viewer logins
   - how to switch `sessionMode`
2. **Architecture:**
   - The package graph `domain ← contracts ← core ← apps`, with `server → domain + contracts`.
   - Why `@sarwa/domain` is separate from `@sarwa/core`: the server can't import React.
   - The view-model plus render-only pattern.
3. **The money model:**
   - integer units (cents, micros, ticks, bps)
   - one rounding helper, with buys rounded up and sells rounded down
   - cost basis stored as a total
   - the books identity
   - holds and buying power
4. **The engine:**
   - the single serialized queue, with coalesced quotes
   - one transaction per fill
   - idempotency
   - the order state machine
   - the gate precedence
5. **Decisions and deviations from the design**, one line each:
   - the reset confirmation uses the account handle, not the email
   - the deviceId is the account identity and the socket auth, so anyone who knows it controls the account (acceptable for a demo; never logged)
   - the collar also applies to stops
   - partial fills apply to limit orders only
   - the 2026–27 holiday table and what happens after it
   - a single instance is assumed
   - push is in-app only, unless M2 is implemented
   - each skipped design item: SMA/Compare badges, named watchlists, admin KPI deltas, Edit schedule, Export CSV, Forgot password, Request access, the audit date range
6. **Testing:**
   - how to run the unit, e2e and mobile manual checks
   - what the property test proves

---

## Definition of done

- From the root, all of these are green: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`, and the web and admin builds.
- The web and admin e2e pass **with no skips**.
- Coverage: domain 100%; contracts and i18n ≥ 95%.
- The A1 repro is a domain test **and** a server e2e test, both ending with `cash ≥ 0`.

## Final report

1. For each item (A1…R): how it was fixed, the test that proves it, or why it was skipped.
2. What the branded types (C1) caught.
3. **Commit plan:** small Conventional Commits, each with the exact `git add <paths>`, placed after the commits you already proposed.
