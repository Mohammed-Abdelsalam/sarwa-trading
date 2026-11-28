# ADR 0007: Integer money, one serialized execution queue, and idempotent orders

## Status

Accepted

## Context

A trading app has to balance to the cent. Floating-point math (`0.1 + 0.2`) does not, and fractional shares make it worse. Many things change an account at the same time: a fill triggered by a tick, a cancel from the user, an admin reset, a halt, a sign-up that claims a guest account. If two of them interleave, cash or shares can be spent twice. Mobile networks retry requests, so the same "place order" can arrive more than once.

## Decision

**Integer, branded money in `@sarwa/domain` (`money.ts`):**

- Every amount is a safe integer in its smallest unit: `Cents` (cash), `Micros` (shares, 1/1,000,000), `Ticks` (prices, 1/10,000 dollar), `Bps` (ratios).
- Each unit is a branded type (`number & { __unit }`), so passing cents where ticks are expected fails to compile, at no runtime cost. Constructors (`cents()`, `ticks()`, ...) reject non-integers.
- Quantity times price is computed in `BigInt` and rounded once through a single `divide` helper. Buys round up and sells round down, so rounding never creates money. Partial fills add up the exact value and round once.
- Floats exist only at the edges (display and user input). The database stores these amounts as `BigInt` columns.

**One execution queue (`apps/server/src/trading/execution-queue.ts`):**

- `ExecutionQueue.run(task)` chains every task on one promise, so tasks run strictly one at a time. Order placement, modify and cancel, fills, alerts, halts, account resets, and guest claim, merge and discard all go through it.
- Each fill runs inside one Prisma interactive transaction: it re-reads the order, account and position, never fills past what is still open, and updates cash, position, order and fill together.

**Idempotent order placement:**

- `POST` orders requires an `Idempotency-Key` header (8 to 64 URL-safe characters). Core's `usePlaceOrder` creates one key per order attempt and reuses it for every retry of that attempt. The client never shows an order optimistically.
- The server stores the key with a SHA-256 hash of the request, unique per account (`@@unique([accountId, idempotencyKey])`).
- The same key with the same body returns the original order (200, a replay). The same key with a different body returns 422 `IDEMPOTENCY_MISMATCH`.
- A business rule failure is stored as a rejected order (201), not thrown as an HTTP error.

## Why

- Integers make the books exact and the tests deterministic; branded types catch unit mix-ups at compile time.
- A single queue removes every race between fills, cancels and resets without row locks, which SQLite does not offer anyway.
- Idempotency keys make retries safe on flaky mobile networks.

## Alternatives considered

- **Decimal libraries (decimal.js, big.js):** exact, but slower, heavier, and easy to mix with plain numbers. Integers with brands are simpler.
- **Floats with rounding at display:** rejected; errors accumulate across partial fills.
- **Database row locks or optimistic version columns:** the usual answer on Postgres, but more complex, and not available on SQLite.
- **No idempotency, rely on the client not to retry:** unsafe.

## Consequences

- Good: money never drifts; the domain package is tested to 100% coverage.
- Good: one mental model for concurrency: everything that writes goes through the queue.
- Bad: **single instance only.** The queue lives in process memory; two server processes would each have their own queue and could interleave. Scaling out means moving the engine into one worker (or a distributed lock) and splitting it from the API.
- Bad: the queue is a throughput ceiling: a slow task delays every other account's work.
- Bad: every amount needs conversion at the UI edge, and contributors must learn the units.
