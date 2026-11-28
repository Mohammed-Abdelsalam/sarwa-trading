# @sarwa/ui

Shared React DOM components for the two Next.js apps, web and admin. It contains primitives (buttons, forms, dialogs, menus, tables, feedback, a command palette) and trading display pieces (price, change pill, sparkline, portfolio charts, status badges). The components are presentational: they take data through props and never fetch. It also ships the Next.js security headers and the CSP builder that both apps use.

## Run, test, build

| Task               | In this folder                | From the root                                      |
| ------------------ | ----------------------------- | -------------------------------------------------- |
| Test (Jest, jsdom) | `pnpm test`                   | `pnpm turbo run test --filter=@sarwa/ui`           |
| Lint / typecheck   | `pnpm lint`, `pnpm typecheck` | `pnpm turbo run lint typecheck --filter=@sarwa/ui` |

There is no build step. The package ships TypeScript source, and web and admin compile it through `transpilePackages`. No port and no env.

## Entry points

- `@sarwa/ui`: components and helpers (`cn`, `useTheme`, `safeLocalStorage`, `toCsv`).
- `@sarwa/ui/locale-cookie`: locale and digit preference cookies, so the server renders the chosen language on first paint.
- `@sarwa/ui/next-config`: plain CommonJS for `next.config.ts` and `proxy.ts`: `securityHeaders`, `contentSecurityPolicy({ nonce, dev, https, apiUrl })`, `forwardClientAddress()`.

## Structure

- `src/primitives/`: generic building blocks (button, controls, form, dialog, overlay, navigation, data, table, feedback, command-palette).
- `src/trading/`: trading-specific display components.
- `src/lib/`: `cn`, theme, browser storage, CSV, locale cookie.
- `next-config.cjs`: the shared header and CSP code.
- `test/`: React Testing Library tests.

## Boundaries

Lint enforces that `ui` imports neither `@sarwa/core` (the hooks entry) nor `@sarwa/core/admin` nor React Query. Helpers and types come from `@sarwa/core/pure`, which is React-free. The locale cookie module uses `@sarwa/core/server`. It also imports no React Native, Expo or Next.js. Colours and fonts come from `@sarwa/tokens`: no hex literals. Mobile does not use this package.

See the [root README](../../README.md), [architecture](../../docs/architecture.md), and ADRs [0003](../../docs/adr/0003-share-logic-not-ui.md) and [0013](../../docs/adr/0013-security-headers-csp-client-ip-rate-limits.md).
