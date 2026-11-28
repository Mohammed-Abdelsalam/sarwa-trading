# CLAUDE.md

Operating manual for AI agents in the Sarwa Mini Trading monorepo. Read it fully before you change anything. The detailed rules are in `.claude/rules/`, and the roles and workflows are in `.claude/agents/` and `.claude/commands/`.

## Project map

pnpm 10 + Turborepo, Node 22 (`.nvmrc`). Workspaces: `apps/*` and `packages/*`.

| App                             | Port         | Purpose                                                                                                |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------ |
| `apps/server` (`@sarwa/server`) | 4000         | NestJS REST API under `/api/v1`, Socket.IO price stream, market simulator, admin API. Prisma + SQLite. |
| `apps/web` (`@sarwa/web`)       | 3000         | Customer web app. Next.js 16 App Router, Tailwind v4. Proxies `/api` and `/socket.io` to the server.   |
| `apps/admin` (`@sarwa/admin`)   | 3001         | Admin dashboard. Next.js 16. Same-origin proxy and cookie auth.                                        |
| `apps/mobile` (`@sarwa/mobile`) | 8081 (Metro) | Customer mobile app. Expo, expo-router, NativeWind.                                                    |

| Package                                                         | Role                                                                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@sarwa/domain`                                                 | Pure trading rules: integer money, sessions, order validation, fills, portfolio, alerts. No dependencies.                                              |
| `@sarwa/contracts`                                              | Zod schemas, inferred types, routes, socket events and constants shared by server and clients.                                                         |
| `@sarwa/core`                                                   | Shared client logic for web, admin and mobile: API client, socket, store, query hooks, view-model data. Entries: `.`, `./pure`, `./server`, `./admin`. |
| `@sarwa/i18n`                                                   | Typed EN and AR catalogs, rejection copy, number and date formatting.                                                                                  |
| `@sarwa/tokens`                                                 | Design tokens (colour, type, spacing, radius, motion), Tailwind preset and CSS.                                                                        |
| `@sarwa/ui`                                                     | Shared DOM components for web and admin.                                                                                                               |
| `@sarwa/eslint-config`, `@sarwa/jest-config`, `@sarwa/tsconfig` | Shared tooling.                                                                                                                                        |

### Dependency rule

Apps depend on packages; nothing imports an app. `domain` is at the bottom, `contracts` sits just above it, and `core` is platform-free. ESLint enforces this (`packages/eslint-config/base.js` plus each package's `eslint.config.mjs`):

- No imports of an app, and no deep imports (`@sarwa/*/src`, `@sarwa/*/dist`). Use public entry points only.
- `domain` imports no packages at all. `contracts` imports only zod and `@sarwa/domain`.
- `core` never imports React Native, Expo, Next, react-dom or `@sarwa/ui`. `core/server.ts` and `core/pure.ts` are React-free.
- Customer apps never import `@sarwa/core/admin`. Client apps do not depend on `@sarwa/domain`; `core` re-exports the rules they need.
- Render-only files (`src/features/**/*.tsx`, `src/components/**/*.tsx`) and view-models (`use-*.ts`) never import React Query or `useSarwa` directly.
- Components use no hex colours or font-file names; they take them from `@sarwa/tokens`.

## Architecture principles

- **Shared-first.** Logic used by more than one app lives in `@sarwa/domain` (pure rules) or `@sarwa/core` (hooks, view data). An app screen is one view-model hook (`use-*.ts`) plus render-only components. DOM helpers shared by web and admin go to `@sarwa/ui`.
- **Contracts first.** Every request, response and socket payload is a Zod schema in `@sarwa/contracts`. The server validates with it and clients parse with it. Change order: contracts → domain → server → core → apps.
- **Pure domain.** Domain functions are deterministic. Clocks, randomness, mailers and storage are injected.
- **Integer money.** Amounts are branded integers in their smallest unit (`Cents`, `Micros`, `Ticks`, `Bps` in `packages/domain/src/money.ts`). Floats exist only at the edges (display, input).
- **Server owns policy.** Auth is default-deny with `@Public()`, PII masking is decided on the server (`apps/server/src/common/pii.ts`), and every input is validated.

## Commands

Run pnpm and node from PowerShell on Windows (the Git Bash node shim is unreliable); use Bash for git.

| Task                    | Command                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Install                 | `pnpm install --frozen-lockfile`                                                                                    |
| Dev (all)               | `pnpm dev` (server runs `db:setup`: creates `.env` from `.env.example`, migrates, seeds)                            |
| Build                   | `pnpm build`                                                                                                        |
| Lint                    | `pnpm lint`                                                                                                         |
| Typecheck               | `pnpm typecheck`                                                                                                    |
| Test                    | `pnpm test`                                                                                                         |
| Test with coverage (CI) | `pnpm test:coverage`                                                                                                |
| Format check            | `pnpm format:check`                                                                                                 |
| One workspace           | `pnpm turbo run typecheck lint test --filter=@sarwa/<ws>`                                                           |
| Shared builds           | `pnpm turbo run build --filter=@sarwa/domain --filter=@sarwa/i18n --filter=@sarwa/contracts --filter=@sarwa/tokens` |
| Prisma client           | `pnpm --filter @sarwa/server exec prisma generate`                                                                  |

Apps consume `domain`, `contracts`, `i18n` and `tokens` from `dist`, so rebuild them after you change one.

**Per-workspace coverage gate:**

```
cmd /c "pnpm turbo run test --filter=<ws> -- --coverage --ci"
```

The filter must come before `--`, because everything after `--` goes to Jest. In PowerShell, wrap it in `cmd /c`, because the PowerShell pnpm shim swallows `--`.

Coverage floors live in each `jest.config.js`: domain 100%, contracts and i18n 95%, core 80% (75% branches), and lower per-app floors for ui, web, admin and mobile. Server and tokens have no floor. swc compiles each `export const` to a getter, so an export that no test reads counts as uncovered. Every new export needs a test that uses it.

Server tests run `jest --runInBand` on a throwaway `prisma/test.db` built by `test/global-setup.js`. `dev.db` is never touched.

## Definition of done

1. `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage` and `pnpm build` are green (CI also runs `pnpm format:check`).
2. Every bug fix starts with a test that fails before the fix. Refactors keep tests green before and after.
3. New UI strings exist in EN and AR in `@sarwa/i18n` and work in RTL. Web pages work at 360, 768, 1024 and 1280 px.
4. Gated admin routes have a VIEWER-gets-403 test.

## Conventions

- Minimal comments: at most a one-line _why_. No comment blocks.
- Keep it simple: no speculative abstractions, no extra files, no dead code.
- Conventional Commits, header at most 100 characters, enforced by commitlint (`commitlint.config.mjs`).
- Allowed scopes: `repo`, `config`, `contracts`, `domain`, `i18n`, `core`, `ui`, `tokens`, `server`, `mobile`, `web`, `admin`, `docs`, `ci`, `ai`, `deps`. Several scopes: `web,admin`. The subject is not sentence-case, start-case, PascalCase or upper-case.
- Hooks: `pre-commit` runs lint-staged (ESLint fix + Prettier), `commit-msg` runs commitlint. Never use `--no-verify`; fix the cause.

Full list: `.claude/rules/conventions.md`.

## Guardrails

- Never `git push`, and never force anything. Commit locally only.
- Never run `prisma migrate reset`, `--force-reset` or `pnpm db:reset`. Never delete a `.db` you did not create.
- Never commit `.env`, `.env.*` (except `.env.example`) or `*.db`.
- Never use `git stash` when several worktrees are active: the stash list is shared, so a `pop` can apply another agent's entry.
- Each agent writes its commit message to its own uniquely named temp file (for example `<branch>-<random>.txt` in the temp directory), never a shared name.
- Temporary servers never use the dev ports 3000, 3001, 4000 or 8081; use 3011–3019 / 4011+, and stop them before you finish.
- Stay inside your brief's file scope. Report anything outside it instead of changing it.
- Next 16 differs from older versions. Read `node_modules/next/dist/docs` before using a Next API.

**Adding a migration:**

1. Edit `apps/server/prisma/schema.prisma`.
2. From `apps/server`, generate the SQL:
   `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url file:<temp path> --script`
3. Save it as `prisma/migrations/<timestamp>_<name>/migration.sql` (write the file directly, not through a PowerShell pipe, which changes the encoding).
4. Re-run the diff without `--script` and confirm "No difference detected".

## Where things live

| Path                  | Contents                                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/ai/`            | How AI was used on this project: prompts, plans, review rounds.                                                                                                               |
| `docs/adr/`           | Architecture decision records.                                                                                                                                                |
| `SECURITY.md`         | Security model and reporting.                                                                                                                                                 |
| `docs/performance.md` | Performance budgets and measurements.                                                                                                                                         |
| `.claude/rules/`      | Agent rules and code conventions.                                                                                                                                             |
| `.claude/agents/`     | Subagent roles: analyst, reviewers, implementer, live verifier. They were distilled from the briefs and rules used during the build; the originals are in `docs/ai/prompts/`. |
| `.claude/commands/`   | Slash commands: `/plan`, `/review`, `/gate`, `/verify-live`, `/brief-agent`, `/commit-plan`.                                                                                  |
