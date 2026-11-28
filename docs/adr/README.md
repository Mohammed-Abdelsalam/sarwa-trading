# Architecture Decision Records

Each record explains one decision: the context, what was decided, why, what else was considered, and the honest consequences. The code is the final source of truth; a record that no longer matches it should be superseded, not silently edited.

| #                                                          | Decision                                                                                     | Status                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [0001](0001-monorepo-pnpm-turborepo.md)                    | Monorepo with pnpm workspaces and Turborepo, boundaries enforced by lint                     | Accepted                                              |
| [0002](0002-expo-mobile-nextjs-web-and-admin.md)           | Expo for mobile, dedicated Next.js apps for web and admin                                    | Accepted                                              |
| [0003](0003-share-logic-not-ui.md)                         | Share logic, not UI: `@sarwa/core` hooks, view-model hook plus pure UI per screen            | Accepted                                              |
| [0004](0004-shared-zod-contracts.md)                       | Shared Zod contracts for HTTP and socket payloads, validated on both sides                   | Accepted                                              |
| [0005](0005-real-backend-nestjs-prisma-sqlite.md)          | A real but simple backend (NestJS, Prisma, SQLite) instead of mocks                          | Accepted                                              |
| [0006](0006-realtime-socketio-snapshot-stream.md)          | Realtime: Socket.IO rooms per symbol, snapshot plus stream, client batching                  | Accepted                                              |
| [0007](0007-integer-money-and-serialized-execution.md)     | Integer branded money, one serialized execution queue, idempotent orders                     | Accepted                                              |
| [0008](0008-customer-accounts-and-sessions.md)             | Customer accounts and sessions: argon2id, rotating refresh, cookies on web, bearer on mobile | Accepted (replaces device id as identity)             |
| [0009](0009-guest-watchlist-device-account.md)             | Guest watchlist through a device account                                                     | Accepted (supersedes "watchlist requires an account") |
| [0010](0010-arabic-and-rtl-first-class.md)                 | Arabic and right-to-left as a first-class locale                                             | Accepted                                              |
| [0011](0011-testing-jest-and-coverage-floors.md)           | Jest everywhere, with per-workspace coverage floors in CI                                    | Accepted (supersedes the Vitest plan)                 |
| [0012](0012-admin-dashboard-separate-app.md)               | Admin dashboard as a separate app, with roles, PII masking and an audit log                  | Accepted                                              |
| [0013](0013-security-headers-csp-client-ip-rate-limits.md) | Security headers, nonce CSP, real client IP, in-memory rate limits                           | Accepted                                              |

## Cross-cutting assumption: one server instance

Several records rely on the API running as a single process: the execution queue (0007), socket rooms and quote batching (0006), and rate limits (0013). Scaling out means splitting the trading engine from the API and moving shared state to Redis (Socket.IO adapter, throttler storage).

## Format

Nygard style, kept short: Status, Context, Decision, Why, Alternatives considered, Consequences. New records take the next number.
