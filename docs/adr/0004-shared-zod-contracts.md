# ADR 0004: Shared Zod contracts for HTTP and socket payloads

## Status

Accepted

## Context

The server and three clients exchange REST bodies, query strings, problem responses and Socket.IO events. TypeScript types alone vanish at runtime: a server change or a malformed payload would only show up as a broken screen. Route paths, header names, cookie names and error codes are also shared, and hard-coded strings drift.

## Decision

- `@sarwa/contracts` is the single source of truth. It holds:
  - Zod schemas for every request, response and socket event, with the TypeScript types inferred from them (`z.infer`).
  - Route tables (`MARKET_ROUTES`, `TRADING_ROUTES`, `ADMIN_ROUTES`, ...) used with `routePath`.
  - Socket event names (`SocketEvent`, `TradingSocketEvent`), the `ErrorCode` enum and the problem schema.
  - Shared constants: cookie and header names, TTLs (`AUTH_TTL_MS`), limits (`AUTH_LIMITS`, `MAX_SUBSCRIBE_SYMBOLS`), batching intervals, retention days.
- **Validated on both sides:**
  - The server validates every body, query and param with `ZodValidationPipe`, and every socket payload with `safeParse`.
  - The client's `createRequest` parses every successful response with its schema and every error with `ProblemSchema`.
  - The market socket checks every incoming event against its schema and drops a shape it does not know. Private events carry a version field (`v: 1`).
- Errors use RFC 9457 problem details with a typed `code`, and clients branch with `isApiError(error, ErrorCode.X)`.
- Contracts may import only zod and `@sarwa/domain` (lint-enforced), so the server and every client can use them.

## Why

- One schema gives both the type and the runtime check, so the two cannot disagree.
- A contract change breaks the typecheck in every consumer in the same pull request (ADR 0001).
- Validating at the client edge turns a server bug into a clear error instead of `undefined` deep in a component.

## Alternatives considered

- **OpenAPI with code generation:** good for public APIs, but it adds a generation step and does not cover Socket.IO events.
- **tRPC:** strong typing, but it couples clients to its transport and does not fit Socket.IO rooms or the Nest controller style.
- **Types only, no runtime checks:** less code, but no protection against drift at runtime.

## Consequences

- Good: no magic strings for routes, events or error codes; every boundary is validated.
- Good: contracts are tested to a 95% coverage floor.
- Bad: parsing every response and tick costs CPU; it is small next to rendering, but it is not free on hot paths.
- Bad: contracts must be rebuilt (tsup) before consumers see a change.
- Bad: older mobile builds in the field will drop event shapes they do not know, so breaking changes need a new version, not an edit.
