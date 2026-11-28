# @sarwa/server

The NestJS API behind every client. It serves REST under `/api/v1` and Socket.IO on the `/market` (quotes, order and session events) and `/admin` namespaces. It also runs the market simulator and the trading engine. Data lives in SQLite through Prisma.

## Diagrams

The server has no UI of its own. The [architecture doc](../../docs/architecture.md) draws its main flows as Mermaid diagrams: [system context](../../docs/architecture.md#system-context), [the journey of a price](../../docs/architecture.md#the-journey-of-a-price), [sign-in and refresh](../../docs/architecture.md#sign-in-and-refresh), [order execution](../../docs/architecture.md#order-execution) and [the guest watchlist](../../docs/architecture.md#guest-watchlist).

## Run, test, build

| Task                       | In this folder                  | From the root                                          |
| -------------------------- | ------------------------------- | ------------------------------------------------------ |
| Dev (migrate, seed, watch) | `pnpm dev`                      | `pnpm turbo run dev --filter=@sarwa/server`            |
| Test (`jest --runInBand`)  | `pnpm test`                     | `pnpm turbo run test --filter=@sarwa/server`           |
| Build / start              | `pnpm build`, then `pnpm start` | `pnpm turbo run build --filter=@sarwa/server`          |
| Lint / typecheck           | `pnpm lint`, `pnpm typecheck`   | `pnpm turbo run lint typecheck --filter=@sarwa/server` |

`pnpm dev` first runs `db:setup`: `scripts/ensure-env.mjs` copies `.env.example` to `.env` if it is missing, then `prisma migrate deploy` applies `prisma/migrations`, then `prisma db seed` runs `prisma/seed.ts`. The seed only creates rows that are missing, so admin edits survive restarts. `postinstall` runs `prisma generate`, and `pnpm db:studio` opens Prisma Studio. Tests build their own throwaway `prisma/test.db` (`test/global-setup.js`) and never touch `dev.db`.

## Port and env

The server listens on `0.0.0.0:4000`, so a phone on the same Wi-Fi can reach it. `src/env.ts` loads `.env` and validates it with Zod: `PORT` (4000), `DATABASE_URL`, `CORS_ORIGINS` (the 3000, 3001 and 8081 origins), `JWT_SECRET` (at least 16 characters; in production at least 32 and not the example value), `WEB_URL` and `ADMIN_URL` (where emailed links point), and `TRUST_PROXY` (`loopback`, for the Next rewrites). The seed reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `VIEWER_EMAIL` and `VIEWER_PASSWORD`. Emails are never sent: `LogMailer`, the only `Mailer`, prints each link to the server log as JSON lines with `"context":"Mail"`. A real mailer is on the roadmap.

## Demo accounts (seed, not in production)

- Admin dashboard: `admin@sarwa.dev` / `admin12345` (ADMIN), `viewer@sarwa.dev` / `viewer12345` (VIEWER).
- Customers: `demo1@sarwa.dev` to `demo4@sarwa.dev`, password `practice-1234`, each with a few seeded trades. The seed also adds 22 stocks across six sectors.

## Structure

- `src/main.ts`: bootstrap (helmet, cookies, CORS, `/api/v1` prefix, problem-details errors). `src/app.module.ts` wires the modules and the global guards (throttler, same-origin, customer default-deny).
- `src/market/`: `MarketService` (price simulator, ticks every 500 ms), `MarketGateway` (quote batching), the stocks controller.
- `src/trading/`: orders, `ExecutionQueue`, `ExecutionService` (fills), `EngineService` (works resting orders on each tick), halts, circuit breaker, alerts, notifications, `TradingGateway`.
- `src/auth/`: customer sign-up and sign-in, rotating refresh sessions, the cookie or bearer transport, `CustomerGuard`.
- `src/watchlist/`: stars for customers and for guest device accounts.
- `src/admin/`, `src/customers/`: the admin API, roles, invites, the audit log, customer management.
- `src/app-config/`, `src/trading-config/`: runtime settings that admins can change.
- `src/common/`: clock, event bus, logger, rate limiter, PII masking, guards, Zod pipe.
- `prisma/`: `schema.prisma`, migrations, `seed.ts`. `test/`: unit tests and e2e tests against a real app.

## Boundaries

The server imports only `@sarwa/contracts` and `@sarwa/domain`. Lint blocks `@sarwa/core`, `@sarwa/ui`, `@sarwa/tokens` and React. See the [root README](../../README.md), [architecture](../../docs/architecture.md), and ADRs [0005](../../docs/adr/0005-real-backend-nestjs-prisma-sqlite.md), [0006](../../docs/adr/0006-realtime-socketio-snapshot-stream.md), [0007](../../docs/adr/0007-integer-money-and-serialized-execution.md), [0008](../../docs/adr/0008-customer-accounts-and-sessions.md), [0009](../../docs/adr/0009-guest-watchlist-device-account.md), [0012](../../docs/adr/0012-admin-dashboard-separate-app.md) and [0013](../../docs/adr/0013-security-headers-csp-client-ip-rate-limits.md).
