# Performance

How Sarwa Mini Trading stays fast with live prices on every screen, organised by app. Each technique names the module that implements it. Numbers come either from the code (with the constant or file named) or from manual Lighthouse runs, and every manual measurement is labelled as one.

The main cost is the price stream. The server simulates ticks for every listed stock. If those reached React one by one, every row on every screen would re-render many times a second. Most of the work below exists to keep that from happening.

## Shared core (`@sarwa/core`)

These run the same way in mobile, web and admin, because the logic lives in the shared package.

### Tick batching

The tick buffer lives in `createMarketSocket` in `packages/core/src/market-socket.ts`.

- **Socket events only fill a buffer.** A `Map` holds the latest quote per symbol and is flushed into the store **every 100 ms** (`flushMs = 100`). Ten ticks for one symbol within a flush become one update.
- **One store update per flush.** `applyQuotes` (`packages/core/src/store.ts`) builds the next `quotes` object once per batch, and skips `set` entirely when nothing in the batch is newer.
- **The server batches too.** `MarketGateway.flush` (`apps/server/src/market/market.gateway.ts`) sends each socket **one** `quotes` message every **250 ms** (`QUOTE_BATCH_MS`), holding only the latest quote of each symbol that socket subscribed to.

### Ordering and de-duplication

`isNewer` (`packages/core/src/store.ts`) accepts a quote only if its `ts` is later, or its `ts` is equal and its `seq` is higher. So:

- out-of-order and duplicate ticks are dropped
- a stale subscribe-ack snapshot never overwrites a fresher tick

### Per-symbol selectors

These live in `packages/core/src/hooks/live.ts`.

- `useQuote(symbol)` selects `state.quotes[symbol]`, so a component re-renders only when **its** symbol changes.
- `useQuotes(symbols)` uses `useShallow`, so a tick re-renders the component only when one of **its** symbols changes.

### Ref-counted subscriptions

`market.acquire(symbols)` counts each symbol's subscribers. When the subscription set changes, a sync runs after **200 ms** (`syncDelayMs`), so fast scrolling settles before the socket is told anything. The sync then:

- unsubscribes symbols nobody uses
- subscribes the new ones in chunks of **50** (`MAX_SUBSCRIBE_SYMBOLS`, which is also the server's per-connection cap)

The subscribe ack carries the current quotes, so a row paints at once instead of waiting for the next tick.

### Query cache settings

TanStack Query `staleTime` values in `packages/core/src/hooks/*`:

| Data                                                                          | `staleTime`                                        |
| ----------------------------------------------------------------------------- | -------------------------------------------------- |
| Orders                                                                        | 15 s                                               |
| Stock list, stock detail, alerts, notifications, portfolio, account, sessions | 30 s                                               |
| Candles, equity history, app config, trading status                           | 60 s                                               |
| Preferences, signed-in user data held in the session                          | `Infinity`; updated by mutations and socket events |

App-level defaults:

- web: `staleTime` 30 s (`apps/web/src/providers/app-providers.tsx`)
- admin: `staleTime` 15 s (`apps/admin/src/providers/app-providers.tsx`)
- mobile: `gcTime` 24 h, so the persisted cache survives (`apps/mobile/src/providers/app-providers.tsx`)

**Retries.** `shouldRetry` (`packages/core/src/api.ts`) doesn't retry 4xx errors (apart from a few retryable statuses) and retries 5xx and network errors a bounded number of times.

**Invalidation over polling.** Live socket events (`stocks:changed`, order updates, account reset) invalidate exactly the affected queries (`useSyncStocksOnChange`, `useTradingEvents`), so nothing polls for these.

## Mobile (Expo / React Native)

- **FlashList.**
  - `@shopify/flash-list`: markets, orders and notifications. The watchlist is a `ScrollView` on purpose: a recycled cell would carry an open swipe to another stock.
  - The viewability callback is kept stable with `useCallback`, because FlashList keeps the first one it gets (`apps/mobile/src/features/markets/markets-screen.tsx`).
- **Memoised rows.** `StockRow`, `PriceFlash` and `Sparkline` are wrapped in `memo` (`apps/mobile/src/components/trading/`).
- **Per-row price selectors.**
  - Each `StockRow` reads its own price with `useQuote(stock.symbol)`, so a tick re-renders only that row, not the list.
  - Before the first tick, the row falls back to the price that came with the list.
- **Only visible rows stream.**
  - The markets screen tracks the on-screen rows with `onViewableItemsChanged` (10 % visibility threshold) and passes only those symbols to `useLiveSymbols` (`use-markets-screen.ts`).
  - Scrolling swaps the subscription set.
  - Other screens subscribe only to what they show, e.g. the home movers and a stock's similar stocks.
- **Reanimated on the UI thread.**
  - These run as Reanimated shared values and animated styles, off the JS thread:
    - the price flash
    - slide-to-confirm
    - the order amount display
    - skeletons
    - the star button
    - the connection badge
    - the stock chart scrubber (`use-price-chart.ts`, with `scheduleOnRN` back to JS only for haptics and state)
  - The price flash respects reduced motion (`useReducedMotion`).
- **AppState pause and resume.**
  - `useMarketConnection` (`packages/core/src/hooks/live.ts`) connects the socket only while the app is foreground **and** online.
  - Only the `background` state pauses it. iOS `inactive` (app switcher, a call, Control Center) does not (`isForeground` in `app-providers.tsx`).
  - NetInfo feeds TanStack's `onlineManager`, so queries and the socket follow one online state. Wi-Fi without internet counts as offline.
- **Offline cache, per user.** `PersistQueryClientProvider` writes a small cache to AsyncStorage under `sarwa.query-cache.<userId>`, or `guest` (`createPersistOptions`).
  - **What is saved:** only what paints the first screens. That is stocks, app config and trading status, plus the signed-in user's watchlist and portfolio.
  - **Other data** (candles, order pages, notifications) refetches.
  - **Max age:** the cache lives 24 h.
  - **App version** busts it, so a new version never restores a cache shaped by an older contract.
  - **Maintenance mode:** a saved maintenance flag is never persisted.
  - **Sign-in** restores that user's cache. **Sign-out** deletes it.
- **React Compiler** is on (`experiments.reactCompiler: true` in `apps/mobile/app.json`), so components and hooks are memoised automatically. Hand-written `memo` is kept only on the hot list rows.

## Web (Next.js)

- **RSC plus a snapshot SSR.**
  - The root layout (`apps/web/src/app/layout.tsx`) prefetches the stock list and the trading status on the server and hands them to the client through `HydrationBoundary`.
  - Market data comes from `apps/web/src/lib/server-api.ts`:
    - `getStocks` and `getStockDetail` use a **5-second** fetch cache (`SNAPSHOT_REVALIDATE_SECONDS = 5`), so page views don't each hit the API. The socket replaces those prices on its first tick, so a snapshot a few seconds old is invisible.
    - `getTradingStatus` is always `no-store`, because halts and the kill switch decide whether a ticket can submit.
    - `cache()` de-duplicates the stock-detail call between a page and its `generateMetadata`.
  - If the API is down, the page still renders and the client retries.
- **Then the stream.** After hydration the socket takes over: the shared tick buffer, the per-symbol selectors and the ref-counted subscriptions described above.
- **Client islands.**
  - On the stock page (`apps/web/src/app/stocks/[symbol]/page.tsx`), the page and `StockHeading` are server components. The interactive parts are client components: `StockActions`, `StockDetailBody` (chart and stats) and `OrderPanel`.
  - Only those islands ship JavaScript for that page.
- **Lightweight charts.** Web charts are plain SVG drawn from the shared `chartGeometry` in `@sarwa/core` (`apps/web/src/components/trading/equity-chart.tsx`, `features/stock-detail/price-chart.tsx`). No charting library is bundled, so there is nothing heavy to code-split.
- **`next/font`.**
  - Inter, Manrope, JetBrains Mono and IBM Plex Sans Arabic are self-hosted through `next/font/google`.
  - Only the Latin faces that every first paint needs are preloaded. Mono and Arabic use `preload: false`.
- **The guest fast path.**
  - With no `sarwa_csrf` cookie, the layout starts the session store as `guest`, not `loading` (`initialStatus` in `layout.tsx`). The server-rendered HTML therefore already contains the guest home and its hero (`features/home/guest-home.tsx`), not a skeleton.
  - On the client, `webCookieAuth.hasCredentials()` (`packages/core/src/auth/transport.ts`) returns false without that cookie, so `useAuthSync` skips the `/me` call and no refresh is attempted.
- **React Compiler** is on (`reactCompiler: true` in `apps/web/next.config.ts`).

### Measured Lighthouse results (web)

Lighthouse was run by hand, locally, on the production build; it is not part of CI. The home page scores 100 for accessibility, SEO and best practices, and the guest fast path, the server-rendered hero and the snapshot cache above made its mobile LCP several times faster. Every recorded score, with the before and after runs, is on the [Lighthouse page](performance/lighthouse/README.md).

## Admin (Next.js)

- **Paginated tables, not virtualised.**
  - The customers list and a customer's orders and activity load **server-side cursor pages** through `useInfiniteQuery` (`packages/core/src/admin/customers.ts`).
  - The audit log uses page-based pagination.
  - Rows are a fixed 56 px, so the customers table is ready for virtualisation, but no virtualiser is in place today.
- **Refetch only while visible.**
  - The overview and market stats poll every **10 s** (`STATS_REFRESH_MS`) with `refetchIntervalInBackground: false` (`packages/core/src/admin/market.ts`, `orders.ts`), so a hidden tab stops polling.
  - Everything else relies on the admin socket and on `staleTime` 15 s.
- **React Compiler** is on (`reactCompiler: true` in `apps/admin/next.config.ts`).
- **Lighthouse best practices: 100** on `/login`, a manual measurement like the web runs above (see the [Lighthouse page](performance/lighthouse/README.md)).

## Server (NestJS)

- **Serialized execution queue.**
  - `ExecutionQueue` (`apps/server/src/trading/execution-queue.ts`) runs every change to accounts, orders and positions one at a time, on a single promise chain.
  - That gives correctness without row locks on SQLite: a fill can't interleave with a cancel or a reset, and there are no retries for lock conflicts.
- **Batched portfolio reads.**
  - `PortfolioService.booksFor` (`apps/server/src/trading/portfolio.service.ts`) values any number of accounts with a **fixed number of queries**: accounts, positions, working orders, today's fills and year-to-date realized P&L.
  - The queries run in one short transaction and in batches of 500 ids, which keeps every `IN` list under SQLite's parameter limit.
  - The admin customer views and the equity snapshot job use the same path.
- **Equity snapshots.**
  - Every 5 minutes (`snapshotIntervalMs` in `packages/domain/src/rules.ts`) equity is recorded with one `createMany`.
  - Only accounts that can move are recorded, meaning those with positions or working orders.
- **Snapshot compaction.**
  - Once an hour, `compactSnapshots` keeps the latest snapshot per hour after 2 days and per day after 90 days, so a year of equity history stays a few thousand rows per account.
  - Equity charts are capped at 300 points.
- **Batched notifications.**
  - `NotificationsService.notify` (`apps/server/src/trading/notifications.service.ts`) de-duplicates account ids and writes notifications with `createManyAndReturn` in batches of 500. A halt or market notice sent to every account stays a handful of queries.
  - `enqueue` runs the fan-out as its own queue task, so it never holds up the fill or halt that caused it.
  - Push delivery is best effort and never blocks a trade. The server push pipeline exists, but the mobile app does not register for push yet, so today notifications arrive in-app and over the socket.
- **Quote fan-out.**
  - Ticks are coalesced per symbol and flushed every 250 ms, as one message per socket.
  - Each socket may hold at most 50 symbol rooms.

## How to measure

- **Lighthouse (web and admin).**
  1. Build and start in production mode (`pnpm build`, then `pnpm start` in the app). Dev mode is much slower and adds `'unsafe-eval'` to the CSP.
  2. Run Lighthouse from Chrome DevTools in an incognito window, mobile and desktop presets.
  3. For the guest numbers, make sure no `sarwa_csrf` cookie is set.
  4. Check `/` and `/stocks/AAPL`, and `/login` on the admin app.
- **React Profiler (web and admin).**
  1. Record in React DevTools while prices stream.
  2. Turn on "Highlight updates when components render". A tick should light up only the rows whose symbol changed, never the whole list.
  3. Components optimised by the compiler show a "Memo ✨" badge.
- **Expo performance monitor (mobile).**
  1. Open the dev menu and choose "Toggle Performance Monitor".
  2. Watch the UI and JS frame rates while scrolling the markets list with the market open. Both should stay near 60 fps.
  3. Animations driven by Reanimated keep the UI thread smooth even when the JS thread is busy.
  4. Measure on a release build (`eas build --profile preview`), not only in Expo Go.
- **Socket traffic.** In the browser's Network tab, filter on WS and open the `/socket.io/` frames.
  - You should see at most one `quotes` message per 250 ms.
  - Subscribe and unsubscribe frames should follow the visible rows.
