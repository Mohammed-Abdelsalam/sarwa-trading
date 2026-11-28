# Architecture

How the Sarwa Mini Trading monorepo fits together: the running system, the package graph and its boundaries, and the four flows worth knowing before you change anything. Every number below comes from the code; the file that owns it is named next to it. Decisions and their trade-offs live in the [ADRs](adr/README.md); setup is in the [root README](../README.md).

## System context

```mermaid
flowchart LR
  subgraph Clients
    M["Mobile<br/>Expo, port 8081 Metro"]
    W["Web<br/>Next.js, port 3000"]
    A["Admin<br/>Next.js, port 3001"]
  end
  subgraph S["Server: NestJS, port 4000"]
    REST["REST /api/v1"]
    IO["Socket.IO<br/>/market and /admin"]
    SIM["Market simulator<br/>+ trading engine"]
  end
  DB[("SQLite<br/>via Prisma")]

  M -- "REST + bearer token" --> REST
  M -- "WebSocket, bearer in handshake" --> IO
  W -- "/api/* and /socket.io/ rewrites" --> REST
  W -.->|same rewrite| IO
  A -- "/api/* and /socket.io/ rewrites" --> REST
  A -.->|same rewrite| IO
  REST --> DB
  SIM --> DB
  SIM --> IO
```

- **Web and admin** call the API on their own origin. `next.config.ts` rewrites `/api/:path*` and `/socket.io/` to `API_URL` (default `http://localhost:4000`), so session cookies stay first-party and need no CORS. Their sockets start with polling, then upgrade to WebSocket. The web app's Server Components also fetch market snapshots straight from `API_URL`, cached for 5 s (`apps/web/src/lib/server-api.ts`).
- **Mobile** talks to the API directly. It uses a bearer token for REST and the socket handshake, and WebSocket transport only. In development `EXPO_PUBLIC_API_URL` wins if it is set; otherwise the URL comes from Expo's `hostUri`, so a phone on the same Wi-Fi works (`apps/mobile/src/lib/api-url.ts`).
- **Server** listens on `0.0.0.0:4000`. Customer quote, order and session events share the `/market` namespace, and the dashboard uses `/admin`. One process owns the simulator, the execution queue, socket rooms and rate limits (see the ADR index note on a single server instance).

## Packages and boundaries

```mermaid
flowchart BT
  domain["@sarwa/domain<br/>pure rules, no deps"]
  contracts["@sarwa/contracts<br/>Zod schemas"]
  i18n["@sarwa/i18n<br/>EN/AR copy"]
  tokens["@sarwa/tokens<br/>design tokens"]
  core["@sarwa/core<br/>client logic"]
  ui["@sarwa/ui<br/>DOM components"]
  server["apps/server"]
  web["apps/web"]
  admin["apps/admin"]
  mobile["apps/mobile"]

  contracts --> domain
  i18n --> domain
  core --> contracts
  core --> domain
  core --> i18n
  core --> tokens
  ui --> core
  ui --> contracts
  ui --> tokens
  server --> contracts
  server --> domain
  web --> core
  web --> ui
  web --> contracts
  web --> tokens
  admin --> core
  admin --> ui
  admin --> contracts
  admin --> tokens
  mobile --> core
  mobile --> contracts
  mobile --> tokens
```

Arrows point at a dependency. `@sarwa/eslint-config` and `@sarwa/tsconfig` are dev dependencies of every app and library; so is `@sarwa/jest-config`, except mobile, which uses `jest-expo`. `domain`, `contracts`, `i18n` and `tokens` build to `dist/`. `core` and `ui` ship TypeScript source.

The rules are lint errors. They live in `packages/eslint-config/base.js` and each workspace's `eslint.config.mjs` ([details](../packages/eslint-config/README.md)):

- Apps are leaves: nothing imports an app. Packages are imported through public entry points only (no `@sarwa/*/src` or `dist` paths).
- `domain` imports no packages. `contracts` has lint deny-lists (React, Socket.IO, TanStack and every `@sarwa/*` package except `domain`); its runtime dependencies are `zod` and `domain`. `i18n` imports only `domain`.
- `core` is platform-free: no React Native, Expo, Next.js, `react-dom` or `@sarwa/ui`. Its `server.ts` and `pure.ts` entries are React-free.
- `ui` is presentational: it may use `@sarwa/core/pure`, but not the hooks entry, `@sarwa/core/admin` or React Query.
- The server's workspace dependencies are `contracts` and `domain`; it imports no client package.
- Customer apps never import `@sarwa/core/admin`. In every app, render-only files and `use-*.ts` view-models never import React Query or `useSarwa`. Components never contain hex colours or font-file names.

## The journey of a price

```mermaid
sequenceDiagram
  autonumber
  participant Sim as MarketService<br/>(server)
  participant GW as MarketGateway<br/>(server)
  participant MS as market-socket<br/>(@sarwa/core)
  participant St as live store<br/>(Zustand)
  participant Row as StockRow<br/>(memo)

  Note over MS,GW: A screen calls useLiveSymbols, so market.acquire() ref-counts symbols. After 200 ms, sync() emits subscribe in chunks of 50. The ack carries a snapshot, applied to the store at once.
  loop every TICK_MS = 500 ms
    Sim->>Sim: tick(): each enabled stock moves with probability 0.6. A new print sets ts = now, seq + 1
    Sim-->>GW: quotes$ (changed quotes only)
    GW->>GW: pending.set(symbol, quote), latest wins
  end
  loop every QUOTE_BATCH_MS = 250 ms
    GW->>MS: flush(): one "quotes" message per socket, holding its subscribed sym:SYMBOL rooms
  end
  MS->>MS: QuotesEventSchema.safeParse, then buffer.set(symbol, quote) in a Map
  loop every flushMs = 100 ms
    MS->>St: applyQuotes([...buffer.values()]), then buffer.clear()
  end
  St->>St: isNewer(next, current): ts greater, or same ts and seq greater. Stale quotes are skipped
  St->>St: one set() for the batch, none if nothing was newer
  St-->>Row: useQuote(symbol) selects state.quotes[symbol]
  Note over Row: Only rows whose quote object changed re-render. The memoized row ignores its parent re-rendering with the same props.
```

| Step                                                                      | Where                                                                                               |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `TICK_MS = 500`, `QUOTE_BATCH_MS = 250`, `MAX_SUBSCRIBE_SYMBOLS = 50`     | `packages/contracts/src/constants.ts`                                                               |
| `tick()`, `MOVE_PROBABILITY = 0.6`, `trade()` sets `ts` and `seq`         | `apps/server/src/market/market.service.ts`                                                          |
| `pending` map, `flush()` per socket, `sym:` rooms, subscribe ack snapshot | `apps/server/src/market/market.gateway.ts`                                                          |
| `buffer` map, `flushMs = 100`, `syncDelayMs = 200`, chunked subscribe     | `packages/core/src/market-socket.ts`                                                                |
| `isNewer`, `applyQuotes`                                                  | `packages/core/src/store.ts`                                                                        |
| `useQuote`, `useLiveSymbols`                                              | `packages/core/src/hooks/live.ts`                                                                   |
| `StockRow = memo(...)`, `useQuote(stock.symbol)`                          | `apps/web/src/components/trading/stock-row.tsx`, `apps/mobile/src/components/trading/stock-row.tsx` |

The gateway joins sockets to `sym:SYMBOL` rooms to record what each one wants. The flush itself loops over the sockets and sends each one a single batch, rather than emitting to each room. The same `quotes$` stream also feeds `EngineService`, which works resting orders on each tick.

## Sign-in and refresh

```mermaid
sequenceDiagram
  autonumber
  participant B as Web browser
  participant N as Next rewrite<br/>(web :3000)
  participant P as Mobile app
  participant API as Server<br/>(AuthController, SessionsService)

  B->>N: POST /api/v1/auth/sign-in (x-device-id)
  N->>API: forwarded, same origin
  API->>API: verify password, settle guest data, start session (new familyId)
  API-->>B: Set-Cookie sarwa_access (httpOnly, path /, 15 min)<br/>sarwa_refresh (httpOnly, path /api/v1/auth)<br/>sarwa_csrf (readable). Body has no tokens
  B->>API: a later write sends the cookies + x-csrf-token copied from sarwa_csrf
  API->>API: CustomerGuard: access cookie valid, not cross-site, header equals cookie, else 403 CSRF_FAILED

  P->>API: POST /api/v1/auth/sign-in (x-client-platform: ios or android, x-device-id)
  API-->>P: accessToken + refreshToken in the body
  P->>P: tokens saved in SecureStore
  P->>API: Authorization: Bearer token (REST and socket handshake), no CSRF needed

  Note over B,API: Refresh, the same on both clients
  B->>API: any call returns 401
  B->>API: POST auth/refresh (web: refresh cookie + CSRF, mobile: refreshToken in body). Concurrent 401s share one refresh
  alt token is the newest of its family
    API->>API: transaction: mark it rotatedAt, create the next row in the same family
    API-->>B: new tokens (cookies or body), then the original call is retried once and the socket reconnects
  else token was already rotated more than 10 s ago (reuse)
    API->>API: revoke the whole family, emit session.revoked to sess:familyId and disconnect those sockets
    API-->>B: 401, signed out
  else rotated within 10 s (a race between tabs or requests)
    API->>API: rotate the family's current live row instead
  end
```

- Refresh lifetimes are 1 day, or 30 days with "keep me signed in" (`AUTH_TTL_MS` in `packages/contracts/src/constants.ts`). Every access-token check also confirms that the family is still live, so a revoke takes effect at once (`SessionsService.authenticate`).
- Code: `apps/server/src/auth/transport.ts` (cookies vs body, CSRF), `auth/sessions.service.ts` (`REUSE_GRACE_MS = 10_000`, rotation), `auth/customer.guard.ts`, `common/same-origin.guard.ts`, `packages/core/src/auth/transport.ts` (`webCookieAuth`, `bearerAuth`), `packages/core/src/auth/session.ts` (`createSessionAuth`), `packages/core/src/api.ts` (retry after refresh).

## Order execution

```mermaid
sequenceDiagram
  autonumber
  participant C as Client<br/>(core usePlaceOrder)
  participant OC as OrdersController
  participant Q as ExecutionQueue
  participant OS as OrdersService
  participant EX as ExecutionService
  participant DB as Prisma / SQLite
  participant TG as TradingGateway

  Note over C: key = newId(), a UUID reused by every retry of this attempt
  C->>OC: POST /api/v1/orders, idempotency-key header, body
  OC->>OC: throttle 30/min, maintenance guard, Zod pipe, sha256 of the body
  OC->>Q: run(place)
  Q->>OS: one task at a time
  OS->>DB: find order by (accountId, idempotencyKey)
  alt key seen with the same hash
    OS-->>C: 200 with the original order (replay)
  else key seen with a different body
    OS-->>C: 422 IDEMPOTENCY_MISMATCH
  else new key
    OS->>OS: validateOrder + estimateOrder (@sarwa/domain)
    OS->>DB: create order (rejected, or open/queued with holds)
    OS->>EX: publish(order), an order.changed event
    opt executesNow
      EX->>DB: $transaction per fill: re-read order, account, position. Check shares and cash. applyFill. Update cash, upsert/delete position, create Fill, update order
      EX->>EX: publish(order, notice)
    end
    OS-->>C: 201 with the order (a broken rule is a stored rejected order, still 201)
  end
  EX-->>TG: EventBus order.changed
  TG-->>C: emit "order.updated" {v: 1, order} to room acct:accountId
  C->>C: OrderUpdatedEventSchema, then applyOrderUpdate: ignore older updatedAt, patch lists and detail, refetch portfolio and account
```

- Resting orders (limits, stops, partial fills) are worked by `EngineService`. It subscribes to `quotes$`, queues one `processQuotes` batch on the same `ExecutionQueue`, and works each symbol's orders oldest first against the displayed size.
- Every write to accounts, orders and positions goes through the one queue (`apps/server/src/trading/execution-queue.ts`). Fills, cancels, placements and resets therefore never interleave.
- The REST answer and the socket event both go through `applyOrderUpdate` (`packages/core/src/hooks/order-cache.ts`), so whichever arrives first wins and the other is a no-op.
- Code: `trading/orders.controller.ts`, `trading/orders.service.ts`, `trading/execution.service.ts`, `trading/engine.service.ts`, `trading/trading.gateway.ts`, `common/events.ts`.

## Guest watchlist

```mermaid
sequenceDiagram
  autonumber
  participant G as Guest client
  participant WL as WatchlistController
  participant AS as AccountsService
  participant AU as AuthService
  participant LC as AccountLifecycleService

  G->>WL: PUT /api/v1/watchlist/AAPL (x-device-id, no session)
  WL->>AS: forDevice(deviceId, create: true), in the queue
  AS-->>WL: device account (deviceId set, userId null)
  WL->>WL: add the star, capped at 50 for guests

  alt Sign-up on this device
    G->>AU: POST auth/sign-up (x-device-id)
    AU->>LC: attach(): in the same queued transaction as the new user
    LC->>LC: device account gets userId, deviceId cleared. Stars move with it
    AU-->>G: session + claimed counts
  else Sign-in to an existing user
    G->>AU: POST auth/sign-in (x-device-id)
    AU->>LC: guestData(deviceId)
    alt device account holds only stars
      LC->>LC: mergeWatchlist(): copy stars the user lacks, delete the device account (one queued transaction)
    else it also holds positions or open orders
      AU-->>G: 409 GUEST_DATA_PRESENT + a 2-minute ticket
      G->>AU: sign-in again with guestTicket
      AU->>LC: discard() the guest account (portfolios are never merged)
    end
    AU-->>G: session
  end
```

The device id is a UUID that `@sarwa/core` creates once and keeps in the client's storage (SecureStore on mobile). Admin metrics count only stars on accounts with a user. Code: `apps/server/src/watchlist/watchlist.module.ts`, `trading/accounts.service.ts`, `trading/account-lifecycle.service.ts`, `auth/auth.service.ts`. See [ADR 0009](adr/0009-guest-watchlist-device-account.md).

## Where to start reading the code

1. `packages/contracts/src/constants.ts`: the shared numbers, names and TTLs that both sides agree on.
2. `packages/domain/src/money.ts`: branded integer money, used by every other rule.
3. `packages/domain/src/execution.ts`: `applyFill` and fill pricing, the heart of the engine.
4. `apps/server/src/app.module.ts`: every server module and the global guards on one page.
5. `apps/server/src/market/market.service.ts`: the simulator and the `quotes$` stream.
6. `apps/server/src/trading/orders.service.ts`: placing an order inside the execution queue.
7. `apps/server/src/auth/sessions.service.ts`: refresh rotation and reuse detection.
8. `packages/core/src/client.ts`: how one client wires the store, socket and API for every app.
9. `packages/core/src/market-socket.ts`: subscriptions, buffering and trading events on the client.
10. `apps/web/src/features/markets/use-markets-page.ts`: a typical screen view-model, rendered by `markets-page.tsx`.
