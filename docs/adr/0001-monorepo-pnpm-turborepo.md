# ADR 0001: Monorepo with pnpm workspaces and Turborepo

## Status

Accepted

## Context

The product has four apps (NestJS server, Expo mobile, Next.js web, Next.js admin). They share a lot: market and order rules, wire schemas, client logic, copy in two languages and design tokens. If each app lived in its own repo, every shared change would need a publish-and-bump cycle, and the copies would drift apart.

## Decision

- One repo with pnpm workspaces (`apps/*`, `packages/*`) and Turborepo for task orchestration (`build`, `lint`, `typecheck`, `test`, all with `dependsOn: ["^build"]`).
- Shared packages:
  - `@sarwa/domain`: pure TypeScript rules (money, orders, sessions, portfolio). No dependencies.
  - `@sarwa/contracts`: Zod schemas, routes, event names, error codes. Depends on domain and zod.
  - `@sarwa/i18n`: EN and AR catalogs and formatters. Depends on domain.
  - `@sarwa/tokens`: design tokens, a Tailwind preset and generated CSS.
  - `@sarwa/core`: client logic (API client, socket, stores, hooks), shipped as TypeScript source.
  - `@sarwa/ui`: React DOM components for web and admin, shipped as TypeScript source.
  - `@sarwa/eslint-config`, `@sarwa/jest-config`, `@sarwa/tsconfig`: shared tooling.
- Dependency direction is enforced by ESLint `no-restricted-imports` rules, not by convention:
  - No package may import an app, and nothing may reach into another package's `src` or `dist`.
  - `domain` imports no package at all. `contracts` imports only zod and domain. `i18n` imports only domain.
  - `core` is platform-free: no React Native, Expo, `react-dom`, Next or `@sarwa/ui`. Its `server` and `pure` entries are React-free.
  - `ui` imports neither React Native nor Next, and does not import the `@sarwa/core` data layer (only `@sarwa/core/pure`).
  - The server shares only contracts and domain with the clients: no core, ui, tokens or React.
  - Customer apps (web, mobile) cannot import `@sarwa/core/admin`.
- Node 22 and pnpm 10 are pinned (`engines`, `packageManager`, `.nvmrc`). `onlyBuiltDependencies` allow-lists install scripts.

## Why

- One pull request can change a contract, the server and all three clients together, and CI checks them together.
- Turborepo caches by inputs, so an untouched package is not rebuilt or retested. Docs and Markdown are excluded from inputs.
- Lint-enforced boundaries keep the layering honest when many contributors (or agents) work in parallel.

## Alternatives considered

- **Polyrepo with published packages:** versioning overhead with no benefit for one team.
- **Nx:** more features (generators, project graph rules), but more configuration than this repo needs. Turborepo plus ESLint rules covers the same needs.
- **npm or Yarn workspaces:** pnpm's strict `node_modules` catches undeclared dependencies, and its install is fast.

## Consequences

- Good: atomic cross-cutting changes; one CI pipeline; boundary mistakes fail lint.
- Good: domain, contracts, i18n and tokens build with tsup; core and ui ship source and are compiled by each app (`transpilePackages` in Next), so editing them needs no rebuild.
- Bad: apps read domain, contracts, i18n and tokens from `dist`, so those must be rebuilt after a change (`turbo` does this for tasks, but a long-running dev server may need a restart).
- Bad: Expo's Metro and pnpm's symlinked layout need care (`transformIgnorePatterns` in mobile Jest, explicit module mappings).
- Bad: pinned React 19 overrides apply to every workspace, so one app cannot upgrade React alone.
