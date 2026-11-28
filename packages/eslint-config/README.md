# @sarwa/eslint-config

The shared ESLint 9 flat configs. They also hold the **dependency boundaries** of the monorepo: every workspace's `eslint.config.mjs` builds on these presets and adds its own `no-restricted-imports` rules, so a wrong import fails `pnpm lint` and CI.

## Use

The package has no scripts and no build. A workspace imports a preset in its `eslint.config.mjs`. Lint runs per workspace: `pnpm turbo run lint --filter=@sarwa/<ws>`, or `pnpm lint` at the root.

| Export           | For                                                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./base`         | Every workspace: TypeScript strict and stylistic type-checked rules, import order, no cycles, unused imports, Prettier. It also exports `restrictedImports()`, `appImportRules()` and `designSystemSyntax`. |
| `./react`        | React and hooks rules (`core`, `ui`).                                                                                                                                                                       |
| `./next`         | `base` + `react` + jsx-a11y + Next core-web-vitals (web, admin).                                                                                                                                            |
| `./react-native` | `base` + `react` + the `expo/*` rules (mobile).                                                                                                                                                             |
| `./nest`         | `base` + Node globals and NestJS allowances (server).                                                                                                                                                       |
| `./jest`         | Jest rules for test files. `jestConfig({ dom, native })` adds Testing Library and jest-dom rules.                                                                                                           |

## Boundary rules

From `base.js`, everywhere:

- No deep imports (`@sarwa/*/src`, `@sarwa/*/dist/**`). Use public entry points only.
- Nothing may import an app (`@sarwa/server`, `mobile`, `web`, `admin`).

From each workspace's `eslint.config.mjs`:

- `domain`: no package imports at all. `contracts`: only `zod` and `@sarwa/domain`. `i18n`: only `@sarwa/domain`.
- `core`: no React Native, Expo, Next.js, `react-dom` or `@sarwa/ui`. `src/server.ts` and `src/pure.ts` are React-free.
- `ui`: no `@sarwa/core`, `@sarwa/core/admin` or React Query (only `@sarwa/core/pure`), and no React Native or Next.js.
- `server`: no `@sarwa/core`, `@sarwa/ui`, `@sarwa/tokens` or React.
- Apps (`appImportRules`): customer apps cannot import `@sarwa/core/admin`. Render-only files (`src/features/**/*.tsx` and `src/components/**/*.tsx`; on mobile `src/components/**/*.{ts,tsx}`) and `use-*.ts` view-models cannot import React Query or `useSarwa`.
- Apps and `ui` (`designSystemSyntax`): no hex colour literals and no font-file names. Take them from `@sarwa/tokens`.

Flat config replaces a rule's options instead of merging them, so narrower rules call `restrictedImports()` to keep the shared boundaries.

See the [root README](../../README.md), [architecture](../../docs/architecture.md), and ADRs [0001](../../docs/adr/0001-monorepo-pnpm-turborepo.md) and [0003](../../docs/adr/0003-share-logic-not-ui.md).
