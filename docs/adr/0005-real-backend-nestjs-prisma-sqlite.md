# ADR 0005: A real but simple backend (NestJS, Prisma, SQLite) instead of mocks

## Status

Accepted

## Context

The take-home brief allowed mocked data. A mock (static JSON or an in-browser fake) cannot show the things that make a trading app hard: prices that move for every client at once, orders that fill against live prices, holds on cash and shares, a portfolio that stays consistent, and an admin who halts a symbol and sees every client react. It also cannot exercise real auth, sessions or rate limits.

The backend still had to be easy to run: a reviewer should get it working with `pnpm install` and `pnpm dev`, without Docker or a database server.

## Decision

- **NestJS 11** server (`apps/server`) with modules for market, trading, watchlist, auth, customers, admin, app config and trading config.
- **Simulated market:** a geometric Brownian motion price model with seeded randomness (`market/simulator.ts`), ticking every 500 ms (`TICK_MS`) with simulated time running 60x faster than wall time. Candle history is generated to end at the current price. All prices are simulated.
- **Live updates** over Socket.IO on the same port (namespace `/market`), see ADR 0006.
- **Prisma 6 with SQLite.** `pnpm dev` creates `.env` from `.env.example` if missing, runs `prisma migrate deploy` and seeds the database. Nothing else to install.
- **Postgres path:** the schema states it; change `provider` in `schema.prisma` and `DATABASE_URL`. Money columns are `BigInt` and roles and statuses are plain strings, which both databases support.
- Clock, randomness, mailer and push sender are injected, so tests control time and side effects.
- Server tests boot the real app on a throwaway SQLite database (`test.db`, rebuilt by Jest global setup) and talk to it with supertest and `socket.io-client`.

## Why

- Live behaviour is the core of the product. A real server lets every client show the same prices, fills and halts at the same moment.
- SQLite needs zero install and keeps the whole stack runnable on a laptop or in CI.
- Prisma gives typed queries, migrations and transactions with little code, and keeps the database swap small.
- NestJS gives modules, guards, pipes and gateways out of the box, so auth and validation are declared once.

## Alternatives considered

- **Mocks or MSW in the clients:** allowed by the brief, but no shared state, no realtime and no real auth.
- **A hosted backend (Firebase, Supabase):** less code, but a cloud account to set up, and the trading engine logic would still need a server.
- **Express or Fastify without Nest:** lighter, but guards, validation pipes and gateways would be hand-written.
- **Postgres from day one:** closer to production, but every reviewer would need Docker or a local server.

## Consequences

- Good: realistic behaviour end to end; the server is covered by e2e tests on a real database.
- Good: zero-install local setup.
- Bad: much more to build and maintain than a mock.
- Bad: SQLite serializes writes and runs in one process, which fits the single-instance design (ADR 0007) but not horizontal scaling.
- Bad: the "one-line switch" covers the schema only. The existing migrations are SQLite SQL (`migration_lock.toml` says `sqlite`), so moving to Postgres needs a new baseline migration.
- Bad: the server Jest config has no coverage floor; it relies on e2e suites rather than a percentage.
