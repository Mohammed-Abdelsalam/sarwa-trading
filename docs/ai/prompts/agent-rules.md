# Rules for every agent working on sarwa-trading (read fully before starting)

Repo: `sarwa-trading`. This is a pnpm 10 + Turborepo monorepo:

- **Apps:** server (NestJS + Prisma/SQLite), web and admin (Next 16), mobile (Expo).
- **Packages:** domain, contracts, core, ui, i18n, tokens, eslint-config, jest-config, tsconfig.

You work in **your own git worktree** on your own branch. Other agents are editing other areas at the same time.

## Context documents (read the parts relevant to your scope)

- `docs/ai/prompts/04-master-plan.md`: the plan, with file:line findings. Read the "User decisions" section.
- `docs/ai/prompts/05-accounts-design-spec.md`: the customer-accounts design spec. Phase 4 only.
- Next 16 differs from older Next. Before you use any Next API (proxy.ts, metadata, error.tsx `retry`, etc.), read `node_modules/next/dist/docs`.

## Setup (once, in your worktree)

1. `pnpm install --frozen-lockfile`. Run it through **PowerShell**, because the Git-Bash node shim is broken. Use PowerShell for pnpm and node, and Bash for git.
2. `pnpm turbo run build --filter=@sarwa/domain --filter=@sarwa/i18n --filter=@sarwa/contracts --filter=@sarwa/tokens`. Apps consume these packages from `dist`, so **rebuild after you change domain, contracts, i18n or tokens**.
3. For server work, also run `pnpm --filter @sarwa/server exec prisma generate`.

## Hard rules

- **Never `git push`**, and never force anything. Commit **locally** on your branch.
- Make small, logical commits as you go, one per fix or refactor.
- Commit messages use Conventional Commits:
  - The header is at most **100 characters**.
  - Use a scope from `commitlint.config.mjs`: repo, config, contracts, domain, i18n, core, ui, tokens, server, mobile, web, admin, docs, ci, ai, deps. Multiple scopes look like `web,admin`.
  - Write a short body that says _why_.
  - End the message with the line: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Never use `--no-verify`. If a hook fails, fix the cause.
- **Every bug fix starts with a test that fails first.** Refactors keep behaviour, and tests stay green before and after.
- Before each commit, run the affected workspaces with `pnpm turbo run typecheck lint test --filter=<ws>...` and keep them green. Server tests always run with `--runInBand`, through `pnpm test`.
- **Never use `git stash`.** The stash list is shared by every worktree, so `pop` can apply another agent's entry. To prove a test fails without a fix, comment the fix out temporarily, or commit and then revert.
- Write commit messages to a **private, uniquely named** temp file, e.g. `%TEMP%\<branch>-<random>.txt`. Never use a shared name, because parallel agents have overwritten each other's messages.
- **Coverage is part of the gate.** CI runs `pnpm test:coverage`, and every workspace has a coverage floor (domain is 100%, contracts is 95%). Your final gate is `cmd /c "pnpm turbo run test --filter=<ws> -- --coverage --ci"`. The filter must come before `--`, because everything after `--` goes to jest. Use `cmd /c` because the PowerShell pnpm shim swallows `--`. swc compiles every `export const` into a getter, so a constant or schema that no test reads counts as an uncovered statement. Every new export needs a test that uses it.
- Never use `prisma migrate reset` or `--force-reset`, and never delete any `.db` except throwaway ones you created.
- To add a migration:
  1. Change `schema.prisma`.
  2. Get the SQL from `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url file:<temp path> --script`.
  3. Write it to `prisma/migrations/<timestamp>_<name>/migration.sql`. Write the file with the Write tool, not by piping PowerShell output.
  4. Re-run the diff without `--script` and confirm "No difference detected".
- Don't commit `.env`, `*.db` or secrets. Don't touch port 3000 (another project may use it). If you need a dev server, use a free port such as 3011–3019 or 4011+, and stop it before you finish.
- Don't edit files outside your scope (listed in your brief). If something outside your scope is truly needed, note it in your final report instead of changing it.

## Code principles (from the user, non-negotiable)

- **Shared-first.** Logic used by more than one app lives in `@sarwa/domain` (pure rules) or `@sarwa/core` (hooks and view data). Apps have one view-model hook per screen (`use-*.ts`) plus render-only components. DOM-only helpers shared by web and admin go in `@sarwa/ui`. Never duplicate logic.
- Clean code and SOLID:
  - Small focused units and thin controllers.
  - Dependency injection for clocks, randomness, mailers and storage.
  - Narrow interfaces.
  - No dead code.
- Minimal comments: at most a one-line _why_ where it isn't obvious. No comment blocks. Keep it simple, with no over-engineering and no unnecessary files.
- Security first:
  - Validate every input with Zod (schemas in contracts).
  - Masking is decided on the server (`apps/server/src/common/pii.ts`).
  - Never put secrets or tokens in localStorage.
- Performance:
  - No N+1 queries.
  - Batched reads (see `PortfolioService.booksFor`).
  - A live tick re-renders only the row that changed.
- All UI strings go through `@sarwa/i18n` in **EN and AR** and must work in **RTL**. Use design tokens only, with no raw hex colours or fonts. Add a11y labels and roles.
- Web pages must be responsive at 360, 768, 1024 and 1280 px.

## Already decided (don't reopen)

- SSR snapshot+stream with a 5 s cache. Locale-in-URL and PPR come later.
- The kill switch blocks new orders only.
- Status codes:
  - 400: validation
  - 201: placed or business-rejected
  - 200: idempotent replay
  - 422: idempotency mismatch
  - 403: VIEWER
  - 503: maintenance
- No browser e2e suite.
- VIEWER sees emails and IPs masked by the server. ADMIN sees them in full.
- Customers sign themselves up; admins never create them.
- Suspending a customer cancels their open orders.
- Admins join through a 48-hour email invite.
- Passwords use argon2id.
- Refresh tokens last 30 days, or 1 day without "keep me signed in".
- The watchlist works for guests through a device account (userId null). Sign-up moves the stars; sign-in merges them.
- The guest landing is the same on web and mobile.

## Final report (your last message)

- Your branch name and `git log --oneline <base>..HEAD`.
- What you changed per commit, in one line each.
- Anything you found but left out of scope.
- Exact gate results: test counts, typecheck and lint.
