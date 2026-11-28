# @sarwa/core

The shared client brain for web, admin and mobile. It holds the API client, the Socket.IO market socket, the live quote store (Zustand), the session and auth transports, the React Query hooks, and the view data the screens render. It is platform-free: each app passes in only its storage, its auth transport and its URLs (`createSarwaClient`), then writes thin screen view-models and pure UI on top.

## Run, test, build

| Task                                               | In this folder                | From the root                                        |
| -------------------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| Test (Jest, jsdom, 80% floor and 75% for branches) | `pnpm test`                   | `pnpm turbo run test --filter=@sarwa/core`           |
| Lint / typecheck                                   | `pnpm lint`, `pnpm typecheck` | `pnpm turbo run lint typecheck --filter=@sarwa/core` |

There is no build step. The package ships TypeScript source. Next.js compiles it through `transpilePackages`, and Metro compiles it for mobile. No port and no env.

## Entry points

- `@sarwa/core`: everything customer apps need: `createSarwaClient`, `SarwaProvider`, hooks (`useQuote`, `useStocks`, orders, portfolio, watchlist, auth...), formatters, chart helpers.
- `@sarwa/core/pure`: React-free helpers and types, for `@sarwa/ui`.
- `@sarwa/core/server`: React-free request client, query keys, formatters and i18n, for Next.js Server Components.
- `@sarwa/core/admin`: the dashboard's API, socket, hooks and copy. Only `apps/admin` may import it.

## Structure

- `src/client.ts`: `createSarwaClient` wires the store, the market socket and the API client (with session refresh) together.
- `src/market-socket.ts`: ref-counted symbol subscriptions, a quote buffer flushed every 100 ms, schema-checked trading events, reconnects with jitter.
- `src/store.ts`: the live store. `isNewer` (by `ts`, then `seq`) drops stale quotes, and each batch causes one update.
- `src/api.ts`: the typed REST client. It parses every response with `@sarwa/contracts`, sends the device id header, and refreshes once on a 401.
- `src/auth/`: `webCookieAuth` (cookies + CSRF header), `bearerAuth` (mobile tokens), session and gate stores.
- `src/hooks/`: React Query and store hooks. `live.ts` has `useQuote` and `useQuotes`, `order-cache.ts` has the single path for order updates, `trading-events.ts` applies socket events.
- `src/admin/`: the admin entry. `src/*.ts`: formatting, charts, ticket and copy helpers.
- `test/`: unit and hook tests.

## Boundaries

Lint enforces that `core` imports no React Native, Expo, Next.js, `react-dom` or `@sarwa/ui`. `server.ts` and `pure.ts` import no React, Zustand, Socket.IO or React Query. `core` depends on `contracts`, `domain`, `i18n` and `tokens`, and re-exports the domain rules the apps need.

See the [root README](../../README.md), [architecture](../../docs/architecture.md), and ADRs [0003](../../docs/adr/0003-share-logic-not-ui.md), [0004](../../docs/adr/0004-shared-zod-contracts.md), [0006](../../docs/adr/0006-realtime-socketio-snapshot-stream.md) and [0008](../../docs/adr/0008-customer-accounts-and-sessions.md).
