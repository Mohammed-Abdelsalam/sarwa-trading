# ADR 0006: Realtime with Socket.IO rooms, snapshot plus stream, and client batching

## Status

Accepted

## Context

Prices tick every 500 ms for every listed symbol. A client only shows some of them (a list page, a detail page, a watchlist), and a list row should re-render only when its own price changes. Clients disconnect (background apps, flaky networks, an admin "drop connections"), and on reconnect they must not show stale or out-of-order prices. Personal events (order updates, alerts, session revocation) must reach only their owner.

## Decision

**Server (`apps/server/src/market/market.gateway.ts`):**

- One Socket.IO namespace, `/market`. Each symbol is a room, `sym:<SYMBOL>`.
- `subscribe` validates the payload, joins the rooms (at most 50 per connection, `MAX_SUBSCRIBE_SYMBOLS`) and acks with a **snapshot**: the current quote of each symbol.
- Ticks are collected in a map keyed by symbol (latest wins) and flushed every 250 ms (`QUOTE_BATCH_MS`): each socket gets **one** `quotes` message with the latest quote of each symbol it joined.
- Every quote carries `ts` and a per-symbol `seq` that increases on every change.
- Market status, app config and stock-list changes are broadcast to everyone.
- Personal events go only to private rooms joined at the handshake: `user:<id>`, `acct:<id>` and a session room. Guests join public rooms only (`trading.gateway.ts`).

**Client (`packages/core/src/market-socket.ts`, `store.ts`, `hooks/live.ts`):**

- **Ref-counted subscriptions:** `acquire(symbols)` returns a release function. Changes are diffed and sent after a short delay (200 ms), in chunks of 50. On reconnect, everything still acquired is subscribed again.
- **Tick buffer:** socket events only write into a `Map<symbol, Quote>`. A timer flushes it into the zustand store every 100 ms (`flushMs`), so a burst of ticks causes one store update.
- **Ordering check:** `applyQuotes` keeps a quote only if it is newer (`ts` greater, or same `ts` and higher `seq`). Late or duplicate quotes, including a snapshot that arrives after a fresher tick, are dropped. If nothing is newer, the store is not updated at all.
- **Per-row subscriptions:** `useQuote(symbol)` selects one symbol from the store, so a tick re-renders only the rows whose price changed. `useQuotes(symbols)` uses a shallow selector for the same effect.
- Every event is validated against its contract schema (ADR 0004).
- On a server-side disconnect the client reconnects after a random jitter (up to 1 s) so dropped clients do not return at once. Socket.IO backoff runs from 500 ms to 15 s.
- The handshake carries the device id and, on mobile, the access token; the web sends its cookie. `reauthenticate` reconnects when the identity changes.

**First paint (web):** server components render with a snapshot from the API (5-second cache), then the socket stream takes over (ADR 0002).

## Why

- Rooms per symbol mean the server only sends what each client watches.
- Batching on both sides bounds the message rate and the render rate, whatever the tick rate.
- Snapshot plus stream gives an instant, correct first frame without waiting for the next tick.
- The `ts`/`seq` check makes reconnects and races safe without server-side session state.

## Alternatives considered

- **Broadcast every tick to everyone:** simple, but wasteful on mobile data and re-renders everything.
- **Raw WebSocket:** less overhead, but no rooms, acks, reconnection or polling fallback.
- **Server-Sent Events:** one-way only; subscribe and unsubscribe would need separate HTTP calls.
- **Polling the REST API:** simple, but slow and heavy on the server.

## Consequences

- Good: steady, bounded traffic and renders; correct order after reconnects; private events stay private.
- Bad: up to about 350 ms of added latency (250 ms server batch plus 100 ms client buffer). Fine for a practice app, not for real trading.
- Bad: rooms and the pending-quote map live in one process. More than one server would need the Socket.IO Redis adapter (see the single-instance note in the [ADR index](README.md)).
- Bad: web and admin connect through the Next rewrite with `['polling', 'websocket']`, so the connection starts with long polling before it upgrades.
