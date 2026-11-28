# @sarwa/domain

The pure trading rules, at the bottom of the dependency graph. Its functions are deterministic TypeScript with no dependencies. Clocks and randomness are passed in. The server engine and the seed use these functions to move money, and the client apps use them through `@sarwa/core` to preview the same results.

## Run, test, build

| Task                       | In this folder                | From the root                                          |
| -------------------------- | ----------------------------- | ------------------------------------------------------ |
| Build to `dist/` (tsup)    | `pnpm build`                  | `pnpm turbo run build --filter=@sarwa/domain`          |
| Watch                      | `pnpm dev`                    | runs as part of root `pnpm dev`                        |
| Test (100% coverage floor) | `pnpm test`                   | `pnpm turbo run test --filter=@sarwa/domain`           |
| Lint / typecheck           | `pnpm lint`, `pnpm typecheck` | `pnpm turbo run lint typecheck --filter=@sarwa/domain` |

Consumers import from `dist`, so rebuild this package after you change it. No port and no env.

## Structure

- `src/money.ts`: branded integer units `Cents`, `Micros` (millionths of a share), `Ticks` and `Bps`, with checked constructors and conversions. Floats exist only at the edges.
- `src/orders.ts`: sides, order types (market, limit, stop), statuses, validation and estimates (`validateOrder`, `estimateOrder`).
- `src/execution.ts`: fill pricing with slippage, fill quantity, `applyFill` (cash, position and order after one fill), stop triggers, the circuit-breaker window.
- `src/portfolio.ts`: positions, cost basis, P&L, buying power.
- `src/session.ts`: the New York market clock, the NYSE calendar, session phases, `orderExpiry`.
- `src/quote.ts`, `src/rules.ts`, `src/alerts.ts`: bid and ask from the last price, admin-editable execution rules and `POLICY`, alert conditions.
- `src/accounts.ts`: the password policy, password strength, auth field errors.
- `test/`: unit tests for every rule.

## Boundaries

Lint forbids any package import here, not even `zod`. Only relative imports are allowed. Everything else may depend on `domain`, but the client apps reach it only through `@sarwa/core`.

See the [root README](../../README.md), [architecture](../../docs/architecture.md), and ADR [0007](../../docs/adr/0007-integer-money-and-serialized-execution.md).
