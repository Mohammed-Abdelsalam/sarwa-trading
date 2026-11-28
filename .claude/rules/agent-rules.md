# Agent rules

Every agent reads this fully before starting. It applies to the main session and to every subagent.

## Context

- pnpm 10 + Turborepo. Apps: server (NestJS + Prisma/SQLite), web and admin (Next 16), mobile (Expo). Packages: domain, contracts, core, ui, i18n, tokens, eslint-config, jest-config, tsconfig.
- Parallel agents each work in their **own git worktree** on their own branch. Assume other agents are editing other areas at the same time.
- Next 16 differs from older Next. Before using a Next API (`proxy.ts`, metadata, `error.tsx` retry, and so on), read `node_modules/next/dist/docs`.
- Decisions recorded in `docs/adr/` are settled. Do not reopen them in a task; raise a concern in your report instead.

## Setup (once per worktree)

1. `pnpm install --frozen-lockfile`. On Windows, run pnpm and node from PowerShell and git from Bash.
2. `pnpm turbo run build --filter=@sarwa/domain --filter=@sarwa/i18n --filter=@sarwa/contracts --filter=@sarwa/tokens`. Apps read these packages from `dist`; rebuild after changing any of them.
3. For server work: `pnpm --filter @sarwa/server exec prisma generate`.

## Git

- Never `git push`. Never force anything. Commit locally on your branch.
- Small, logical commits: one per fix or refactor.
- Conventional Commits:
  - Header at most 100 characters.
  - Scope from `commitlint.config.mjs`: repo, config, contracts, domain, i18n, core, ui, tokens, server, mobile, web, admin, docs, ci, ai, deps. Several scopes: `web,admin`.
  - A short body that says _why_.
  - End with the co-author trailer the session specifies.
- Never `--no-verify`. If a hook fails, fix the cause.
- Never `git stash`. The stash list is shared by every worktree, so `pop` can apply another agent's entry. To prove a test fails without a fix, comment the fix out temporarily, or commit and then revert.
- Write commit messages to a **private, uniquely named** temp file (`<branch>-<random>.txt`). Parallel agents using a shared name have overwritten each other's messages.

## Tests and gate

- **Every bug fix starts with a test that fails first.** Refactors keep behaviour; tests stay green before and after.
- Before each commit: `pnpm turbo run typecheck lint test --filter=<ws>...` for the affected workspaces.
- Server tests always run with `--runInBand` (the `test` script does this) on the throwaway `prisma/test.db`.
- **Coverage is part of the gate.** CI runs `pnpm test:coverage`, and each workspace has a floor in its `jest.config.js` (domain 100%, contracts 95%, i18n 95%).
- Final per-workspace gate:

  ```
  cmd /c "pnpm turbo run test --filter=<ws> -- --coverage --ci"
  ```

  The filter goes before `--`, because everything after `--` goes to Jest. `cmd /c` is needed because the PowerShell pnpm shim swallows `--`.

- swc compiles every `export const` to a getter, so a constant or schema that no test reads counts as uncovered. Every new export needs a test that uses it.

## Data and environment

- Never `prisma migrate reset`, `--force-reset` or `pnpm db:reset`. Never delete a `.db` except a throwaway one you created.
- Adding a migration:
  1. Change `apps/server/prisma/schema.prisma`.
  2. From `apps/server`: `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url file:<temp path> --script`.
  3. Write the output to `prisma/migrations/<timestamp>_<name>/migration.sql` with the file-write tool, not a PowerShell pipe.
  4. Re-run the diff without `--script`; it must print "No difference detected".
- Never commit `.env`, `*.db` or secrets.
- Temporary servers never use the dev ports 3000, 3001, 4000 or 8081; use 3011–3019 / 4011+, and stop them before you finish.

## Scope

- Edit only the files your brief lists. If something outside scope is truly needed, put it in your report instead of changing it.

## Code principles

- **Shared-first.** Logic used by more than one app lives in `@sarwa/domain` (pure rules) or `@sarwa/core` (hooks, view data). Apps have one view-model hook per screen (`use-*.ts`) plus render-only components. DOM helpers shared by web and admin go to `@sarwa/ui`. Never duplicate logic.
- Clean code and SOLID: small focused units, thin controllers, injected clocks, randomness, mailers and storage, narrow interfaces, no dead code.
- Minimal comments and no over-engineering (see `conventions.md`).
- Security: validate every input with Zod schemas from contracts; masking is decided on the server (`apps/server/src/common/pii.ts`); never put secrets or tokens in localStorage.
- Performance: no N+1 queries, batched reads (see `PortfolioService.booksFor`), and a live tick re-renders only the row that changed.
- Every UI string goes through `@sarwa/i18n` in EN and AR and must work in RTL. Design tokens only. Add a11y labels and roles.
- Web pages are responsive at 360, 768, 1024 and 1280 px.

## Final report

Every agent ends with:

- Branch name and `git log --oneline <base>..HEAD`.
- One line per commit: what changed.
- Findings left out of scope.
- Exact gate results: test counts, coverage, typecheck and lint.
