# Prompt 01 — Shared-core cleanup + Mobile/Web parity

You are working in the `sarwa-trading` repo (pnpm + Turborepo: `apps/mobile` Expo, `apps/web` Next, `apps/server` NestJS, `packages/{contracts,core,ui,tokens}`). The server is out of scope: do not change it.

## 0. Preconditions (stop and tell me if any fails)

- `apps/web` must already be committed and merged into `main`, together with the pending `packages/*` changes (`candleGeometry`, `axisTicks`, `similarStocks`, `rangePosition`, `week52` in `useStockDetail`).
- If `git status` is not clean, STOP and ask me to commit. Never run `git commit` or `git push` yourself.
- Then run `git switch main && git pull && git switch -c refactor/core-parity`.
- Run `pnpm lint && pnpm typecheck && pnpm test` once and confirm a green baseline before changing anything.

## 1. House rules (apply to every line)

1. **All logic lives in `@sarwa/core`** (pure functions + data hooks). An app screen is `use-<screen>-screen.ts` / `use-<page>-page.ts` (composes core hooks + local UI state) plus pure render components. Before writing logic in an app, ask "would the other app need this?". If yes, it goes to core.
2. Mobile and web behave the same: same data, copy, defaults and states (loading / error / empty / stale / removed). Only the rendering differs.
3. The design canvas is the source of truth. Read it with the Artifact tool (`<design canvas link>`, boards `M-Detail`, `M-Watchlist`, `W-Detail`, `W-Watchlist`, `Dev-Notes`) before building UI.
   - Where a board doesn't cover something, build it only from existing components and `@sarwa/tokens`.
   - No hex values, no raw font strings (lint enforces it).
4. No comment blocks or JSDoc. At most one single-line comment, and only for a non-obvious _why_.
5. Clean, explainable senior code: no extra abstraction layers, no speculative options, and no files that hold a single trivial line.
6. Every new core function/hook gets unit tests in `packages/core/test`. Changed screens keep or extend their tests, and coverage gates must pass.
7. Accessibility parity: every new control has a role, a label and a selected/disabled state. Mobile uses `Haptics.selectionAsync()` for selections and `impactAsync(Light)` for confirmations.

## 2. Phase A — Move duplicated logic into `@sarwa/core`

After each item, switch **both** apps to the new code and delete the old app-level code. Export everything new from `packages/core/src/index.ts`.

### A1. Stale prices

- `status.ts`: `isStale(status: LiveStatus): boolean`, true for `'offline'` or `'paused'`.
- `hooks/live.ts`: `useIsStale(): boolean`.
- Replace the four copies of `status === 'offline' || status === 'paused'` in:
  - `apps/mobile/src/features/markets/use-markets-screen.ts`
  - `apps/mobile/src/features/watchlist/use-watchlist-screen.ts`
  - `apps/web/src/features/markets/use-markets-page.ts`
  - `apps/web/src/features/watchlist/use-watchlist-page.ts`

### A2. Sector label

- `markets.ts`: `sectorFilterLabel(id: SectorFilter): string`.
- Replace `SECTOR_FILTERS.find((f) => f.id === sector)?.label ?? 'All'` in both markets hooks.

### A3. Sorting without the fake filter

- `markets.ts`:
  - Extract `sortStocks(stocks, sort)` from `filterAndSort`, and make `filterAndSort` call it, with no behaviour change.
  - `nextWatchlistSort(current: SortOption | null): SortOption | null`. `null` means "Order added" (server order). It cycles null → each `SORTS` entry in order → null.
- `hooks/watchlist.ts`: `useWatchlistStocks({ sort }: { sort?: SortOption | null } = {})` applies `sortStocks` when `sort` is set.
- Web `use-watchlist-page.ts`: delete `filterAndSort(rows, { query: '', sector: 'all', sort })` and pass `sort` to the core hook. `sortByColumn` stays for the table headers.

### A4. Watch toggle for a single symbol

- `hooks/watchlist.ts`: `useWatchToggle(symbol)` → `{ watched: boolean; toggle: () => void }`, built on `useIsWatched` + `useToggleWatchlist`.
- Use it in:
  - `apps/mobile/src/features/stock-detail/use-stock-detail-screen.ts`
  - `apps/web/src/features/stock-detail/use-stock-detail-page.ts`
  - `apps/web/src/features/markets/use-stock-preview.ts`
- List screens keep `useToggleWatchlist` + `useWatchedSymbols`, because they toggle many symbols.

### A5. Undoable remove (deferred delete, app-wide)

**Goals:**

- Undo puts the stock back in its **original position**.
- Every screen agrees on the state during the 5-second window.

**Why the current approach fails:**

- Web deletes at once, and Undo re-adds the stock. The server orders the watchlist by `createdAt`, so the stock jumps to the end.
- The pending state must not live in a component:
  - Expo tabs stay mounted, so a component-held state would keep the star filled on Markets while the row is hidden on Watchlist.
  - A timer held by an unmounted component can't be trusted to commit.

**Implementation:**

- `packages/core/src/undo.ts`: `createRemovalQueue(timeoutMs = 5_000)` returns a tiny external store holding one pending item: `{ getPending(): string | null; subscribe(listener): () => void; schedule(symbol, commit: () => void): void; undo(): void; flush(): void }`.
  - `schedule` while an item is pending calls `flush()` first, which commits the earlier item.
  - `undo` clears the timer and the pending item without calling `commit`.
  - `flush` runs the pending `commit` now.
- `SarwaClient` gets `removals: RemovalQueue`. `apps/mobile/src/lib/client.ts` and `apps/web/src/lib/client.ts` create it.
- `hooks/watchlist.ts`:
  - `usePendingRemoval(): string | null` uses `useSyncExternalStore` over `client.removals`.
  - `useWatchlist()` adds a `select` that filters out the pending symbol. This one change makes Markets stars, `useIsWatched`, `useWatchedSymbols`, watchlist rows and the average all agree, even if a refetch returns the symbol during the window.
  - `useUndoableRemove()` → `{ pending, remove(symbol), undo(), dismiss() }`.
    - `remove` calls `removals.schedule(symbol, commit)`. `commit` must not depend on a mounted component: it uses the `queryClient` and `api` captured when `remove` was called, in this order:
      1. `setQueryData(queryKeys.watchlist, list => list.filter(s => s !== symbol))`, so the row never flashes back when pending clears;
      2. `api.removeFromWatchlist(symbol)`;
      3. `invalidateQueries(queryKeys.watchlist)` whether the call succeeds or fails, so a failure brings the row back from the server.
    - `dismiss` = `removals.flush()`.
  - `useToggleWatchlist()` returns the mutation with a wrapped `mutate`. Starring a symbol that is currently pending (`watched === false && symbol === pending`) calls `removals.undo()` and sends no PUT.
- If the app is killed or the tab closes inside the window, the delete never happens and the stock stays watched. That is the intended safe failure; write it as a one-line comment.
- The `RemovedStock` screen's "Remove from Watchlist" button keeps the immediate toggle, with no undo.
- Web `use-watchlist-page.ts`: delete its `removed` state, `UNDO_MS` and the timer effect, and use `useUndoableRemove`. The existing `Toast` keeps its copy, `` `${symbol} removed from Watchlist` ``, with Undo and dismiss.
- Tests (fake timers):
  - commits after the timeout
  - undo → no API call and the original order is kept
  - a second remove commits the first
  - re-starring a pending symbol cancels it with no PUT
  - `useIsWatched` is false while pending
  - a failed commit brings the row back
- Update `apps/web/test/features/watchlist/use-watchlist-page.test.tsx`: "stars the stock again when undo is pressed" now asserts that no API call is made.

### A6. Chart model shared by both apps

- `chart.ts`:
  - `type ChartType = 'area' | 'candle'`
  - `CHART_TYPES = [{ value: 'area', label: 'Area' }, { value: 'candle', label: 'Candlestick' }] as const`. These are the labels web already uses as `aria-label`. Icons stay per app, because `lucide-react` and `lucide-react-native` are different packages, so each app maps `value → icon`.
  - `parseChartType(value: string | null): ChartType`
  - `parsePeriod(value: string | null): Period`, moved from `use-stock-detail-page.ts`
  - `scrubPoint(candle, baseline: number | null)` → `{ candle, changePct }`. This replaces the copies in mobile `use-price-chart.ts` (`select`) and the web crosshair.
  - `periodChange(candles, baseline)` → `{ value, pct } | null`, moved from web `use-price-chart.ts`
  - `candleIndexAt(count, width, x)` with the `'worklet'` directive, like `nearestPointIndex`. It replaces web's `Math.floor(x / (VIEW_WIDTH / count))` clamp and is used by both apps.
  - `ohlc(candle): KeyStat[]` → Open / High / Low / Close formatted with `formatPrice`
- `hooks/market.ts`: `useChartSeries` also returns `periodChange`.
- `use-stock-detail-page.ts` and web `use-price-chart.ts` import `ChartType`, `parsePeriod` and `parseChartType` from core. Delete the local copies.

### A7. Stored UI preferences

- `SarwaClient` gets `storage: KeyValueStorage`.
  - Mobile passes `AsyncStorage`, which is already used for the device id.
  - Web passes its existing `browserStorage` in `apps/web/src/lib/client.ts`, reused for the device id.
- `hooks/preferences.ts`: `usePreference<T extends string>(key, allowed, fallback)` → `{ value, setValue, isLoaded }`.
  - Reads through React Query (`queryKeys.preference(key)`, `staleTime: Infinity`, `queryFn` = `storage.getItem`).
  - Writes with `setQueryData` + `storage.setItem`.
  - A stored value that isn't in `allowed` falls back.
- Mobile uses it for the chart period (`sarwa.chart.period`) and the chart type (`sarwa.chart.type`). The chart shows its existing loading skeleton until `isLoaded`, so it never fetches `1D` first and then jumps.
- Web keeps period/type in the URL, because shareable links are a web feature. It also keeps `useLocalPreference` for the table/grid view, because it is synchronous and avoids a hydration flash.
- Update every place that builds a `SarwaClient` in tests (`packages/core/test/utils.tsx` `createTestClient`, and the mobile/web test setups) with an in-memory `storage` and a real `createRemovalQueue()`.

## 3. Phase B — Bring mobile to web parity

### B1. Chart type toggle

- Web already renders this as an icon-only `SegmentedControl` (icon shown, `label` as `aria-label`). Do not redesign web. Only feed its options from `CHART_TYPES` + a local `value → icon` map.
- Mobile: new `apps/mobile/src/components/trading/chart-type-toggle.tsx`.
  - Icon-only segments using `ChartArea` / `ChartCandlestick` from `lucide-react-native`.
  - Match web's look and the mobile `PeriodTabs` tokens: `rounded-seg bg-surface-3 p-seg-pad`; the selected segment is `bg-surface dark:bg-border-strong`.
  - Each segment is ≥ 44 pt.
  - a11y: `accessibilityRole="tablist"` on the container and `"tab"` on segments, with the label from `CHART_TYPES` and `accessibilityState={{ selected }}`.
  - Haptic: `selectionAsync`.
- Layout: one row, with `PeriodTabs` at `flex-1` and the toggle on the right, separated by the standard gap.

### B2. Candlestick + volume on mobile

- `features/stock-detail/use-price-chart.ts` takes `type`. It uses `chartGeometry` for area and `candleGeometry` for candle, with no geometry written in the app.
- The gesture worklet uses `nearestPointIndex` (area) or `candleIndexAt` (candle). The haptic fires on each new index, and `scrubPoint` builds the value passed to `onScrub`.
- `price-chart.tsx`, candle mode:
  - per shape, a wick `Line` + body `Rect`, coloured `colors.pos` / `colors.neg`;
  - volume bars under the chart.
  - Add `layout.detail.volumeHeight` to `@sarwa/tokens` (web currently hard-codes a 44 px band with 40 px bars) and use it in **both** apps, removing web's magic numbers.
- Keep the crosshair, the long-press activation and `accessibilityLabel={summary}` in both modes.
- While scrubbing in candle mode, `PriceHeader` shows the close + change (as today) plus a compact O/H/L/C row from `ohlc(candle)`. Web's crosshair tooltip shows the same `ohlc` rows in candle mode.

### B3. Period change

When the period is not `1D` and nothing is scrubbed, mobile shows `ChangePill variant="inline"` + "this period" under the toolbar, from `useChartSeries().periodChange`. This is the same copy as web's `ChartToolbar`.

### B4. 52-week range

New `features/stock-detail/range-card.tsx`, rendering `week52` from `useStockDetail` (already returned by core, unused on mobile).

- Same title ("52-week range"), gradient bar, marker and low/high labels as web `RangeCard`.
- `accessibilityRole="progressbar"` with `accessibilityValue={{ min, max, now }}`.
- Placed under `KeyStats`.

### B5. Similar stocks

Under the range card, add a "More in <Sector>" section: a horizontal `ScrollView` of compact cards, each a `Link` to `/stock/<symbol>`.

- Each card shows: avatar, symbol, name, sparkline, a live price from `useQuote`, and a `ChangePill`.
- Data comes from `similarStocks(useStocks().data ?? [], symbol)`, and the cards stream with `useLiveSymbols`.
- Hidden when empty. Same title copy as web: `More in ${sectorLabel}`.

### B6. Pull-to-refresh on stock detail

- Core: `useRefreshStock(symbol)` → `{ refresh, isRefreshing }`.
  - `refresh` awaits `invalidateQueries({ queryKey: queryKeys.stock(symbol) })`. The key is `['stocks', symbol]`, so it also refreshes that symbol's candles and never the whole list.
  - `isRefreshing` is local state, true only while that promise runs. Do not use `useIsFetching`: the spinner would show on every period change and background refetch.
- Mobile: a `RefreshControl` on the detail `ScrollView`, with the same tint/title props as Markets.

### B7. Share

- Core: `shareStockMessage({ symbol, name, quote }): string`, e.g. `"AAPL · Apple Inc. $192.30, +1.24% today"` using the existing formatters.
- Mobile `TopBar` gets an `IconButton` (`Share2`, label "Share") that calls `Share.share({ message, url })`, where `url = Linking.createURL(`/stock/${symbol}`)` (`expo-linking` is installed; scheme `minitrading`).
- Web: no change. The page URL is the share.

### B8. Watchlist: undo + sort

- Swipe-open or tapping Remove → `useUndoableRemove().remove(symbol)` + a light haptic.
- New `apps/mobile/src/components/ui/snackbar.tsx`:
  - Absolutely positioned at the bottom of the screen container (the tab screen already ends above the tab bar).
  - Tokens only. `accessibilityLiveRegion="polite"` + `accessibilityRole="alert"`.
  - Enters/leaves with Reanimated `FadeInDown`/`FadeOutDown`, and skips the animation when `useReducedMotion()`.
  - Text `"<SYMBOL> removed from Watchlist"`, an "Undo" action and a dismiss action (= `dismiss`).
  - Visible while `pending` is set.
  - Give the list bottom padding so the snackbar never covers the last row.
- Sort: a sort button in the summary row, the same pattern as Markets `ListMeta`, driven by `nextWatchlistSort`.
  - `null` shows "Order added".
  - Sort is screen state, not persisted, matching web.
- Keep the watchlist on `ScrollView` + `map`. Do not switch it to `FlashList`: recycled cells would carry a swipeable's open state to another symbol, and the list is small.

### B9. Keep the detail screen readable

`stock-detail-screen.tsx` is already 240 lines.

- Move `TopBar`, `PriceHeader` and `RemovedStock` into their own files under `features/stock-detail/`. They hold render code only.
- `use-stock-detail-screen.ts` stays the single place that composes the hooks.

## 4. Phase C — Consistency sweep

- Grep both apps for leftovers and move anything shared into core:
  - `changePct(` / `percentChange(` math inside hooks
  - `toggle({ symbol, watched` wrappers
  - `setTimeout` used for UI state
  - `.find(` over constants
- Identical copy in both apps for: errors, empty states, removed stock, undo, sort labels, "this period", "52-week range", "More in …", and the "Simulated data" note.
- Default sort, default period (`1D`), default chart type (`area`) and the admin-disabled fallback (`resolvePeriod`) must behave the same on both.
- The one intended difference: web keeps period/type in the URL, and mobile remembers the last choice. A stored mobile period that the admin later disables still goes through `resolvePeriod`.

## 5. Tests and verification

- **Core:**
  - unit tests for every item in Phase A plus `shareStockMessage`
  - hook tests for `useUndoableRemove`, `usePreference`, `useRefreshStock` and `useWatchlistStocks({ sort })`
- **Mobile:**
  - `stock-detail-screen.test.tsx`:
    - the toggle switches mode and the choice is stored
    - candle mode renders candles
    - the range card renders
    - similar cards render
    - share builds the message
    - pull-to-refresh calls refresh
  - `watchlist-screen.test.tsx`:
    - remove shows the snackbar
    - undo restores the row with no API call
    - sort cycles
- **Web:** update the tests touched by the moved logic:
  - `use-watchlist-page.test.tsx`
  - `watchlist-page.test.tsx`
  - `price-chart.test.tsx` (OHLC in candle mode)
  - `stock-detail-page.test.tsx`
- `pnpm lint && pnpm typecheck && pnpm test` must pass, including coverage gates.
- Run the server, the mobile app and web, and check by hand:
  - toggle + scrub in both chart modes, and the choice survives an app restart
  - offline → banner + stale styling on both
  - remove → undo → same position on both
  - remove on Watchlist → switch to Markets within 5 s → the star is empty → star it → the delete is cancelled
  - the admin disables the selected period while the chart is open → it falls back on both

## 6. When done

Report back: list each file changed, grouped by phase, plus any decision that differs from this prompt and why. Then give me, without running them:

```
git add -A
git commit -m "refactor(core): share stale, sort, undo, chart and preference logic; bring mobile to web parity"
git push -u origin refactor/core-parity
```

and a short PR description.
