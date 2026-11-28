# @sarwa/contracts

The shared language of the server and the clients. It holds the Zod schemas and their inferred types for every HTTP request and response and every socket payload, plus route paths, socket event names and shared constants. The server validates input with these schemas, and the clients parse responses and socket events with them, so the two sides cannot drift apart without a type or test failure.

## Run, test, build

| Task                                       | In this folder                | From the root                                             |
| ------------------------------------------ | ----------------------------- | --------------------------------------------------------- |
| Build to `dist/` (tsup, CJS + ESM + types) | `pnpm build`                  | `pnpm turbo run build --filter=@sarwa/contracts`          |
| Watch                                      | `pnpm dev`                    | runs as part of root `pnpm dev`                           |
| Test (95% coverage floor)                  | `pnpm test`                   | `pnpm turbo run test --filter=@sarwa/contracts`           |
| Lint / typecheck                           | `pnpm lint`, `pnpm typecheck` | `pnpm turbo run lint typecheck --filter=@sarwa/contracts` |

Consumers import from `dist`, so rebuild this package after you change it. No port and no env.

## Structure

- `src/index.ts`: the public entry. It imports `zod-config.ts` first, which sets `z.config({ jitless: true })` so schemas do not trip the apps' CSP.
- `src/constants.ts`: `API_PREFIX` (`api/v1`), `MARKET_NAMESPACE`, `TICK_MS` (500), `QUOTE_BATCH_MS` (250), `MAX_SUBSCRIBE_SYMBOLS` (50), cookie and header names, `AUTH_TTL_MS`.
- `src/routes.ts`: route paths (`MARKET_ROUTES`, `TRADING_ROUTES`, `AUTH_ROUTES`, `ADMIN_ROUTES`), plus `routePath()`.
- `src/api.ts`: `ErrorCode`, problem-details shapes, shared request schemas.
- `src/market.ts`, `src/trading.ts`, `src/auth.ts`, `src/config.ts`: domain-facing schemas (quotes, orders, idempotency key, sessions, app config).
- `src/socket.ts`, `src/trading-socket.ts`: socket event names and payloads. Trading events carry `v: 1`.
- `src/admin*.ts`: admin API and admin socket schemas.
- `src/domain-ties.ts`: compile-time checks that a wire schema matches the `@sarwa/domain` type it carries, plus `toDomain()`.
- `test/`: schema tests.

## Boundaries

Only `zod`, `@sarwa/domain` and its own files. Lint blocks React, the other `@sarwa/*` packages, Socket.IO and TanStack.

See the [root README](../../README.md), [architecture](../../docs/architecture.md), and ADR [0004](../../docs/adr/0004-shared-zod-contracts.md).
