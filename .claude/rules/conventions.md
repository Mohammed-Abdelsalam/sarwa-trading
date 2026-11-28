# Code conventions

## Structure

- Change order for a feature: contracts → domain → server → core → apps.
- `@sarwa/domain`: pure, deterministic TypeScript. No packages, no I/O, no `Date.now()` or `Math.random()`; take them as arguments.
- `@sarwa/contracts`: Zod schemas and inferred types only. Routes, socket events and error codes are constants here, never magic strings in apps.
- `@sarwa/core`: platform-free. Hooks and view data for every client. `@sarwa/core/pure` and `@sarwa/core/server` stay React-free. Admin-only code goes in `@sarwa/core/admin`.
- Apps: one view-model hook per screen (`use-*.ts`) that reads data through core hooks, plus render-only components in `src/features` and `src/components`.
- Server: thin controllers, one concern per service, dependencies injected (`Clock`, `Random`, `Mailer`, event bus). Policies such as PII masking live in the mapping layer, not in controllers.

## Types and money

- Amounts are branded integers: `Cents`, `Micros` (quantity), `Ticks` (price), `Bps`. Build them with `cents()`, `micros()`, `ticks()`, `bps()`; never cast a float.
- Convert to floats only for display and parse from floats only at input.
- Infer types from Zod schemas (`z.infer`); do not hand-write a parallel interface.
- ESLint runs `strictTypeChecked` with exhaustive `switch`, `consistent-type-imports` (inline) and no floating promises.

## UI

- Every string comes from `@sarwa/i18n`, in EN and AR. Check RTL.
- Colours, fonts, spacing and motion come from `@sarwa/tokens`. No hex literals or font-file names (lint enforces this).
- Accessible names and roles on every interactive element.
- Web layouts use CSS breakpoints, not JS media queries. Tables have a stacked-row fallback below `md`.
- A live price tick re-renders only the changed row: subscribe narrowly and memoise rows.

## HTTP semantics

- 400 validation, 201 order placed or business-rejected, 200 idempotent replay, 422 idempotency mismatch, 403 VIEWER on admin writes, 503 maintenance, 429 `RATE_LIMITED` with `Retry-After`.
- Errors are problem+json with a stable `code` from contracts.

## Comments and size

- At most a one-line comment explaining _why_. No comment blocks, no commented-out code, no restating the code.
- Keep it simple: no speculative abstraction, no new file without a reason, no dead exports.

## Tests

- Jest with the swc transform; tests live in `<workspace>/test/**/*.test.ts(x)`.
- Bug fix: failing test first, then the fix.
- New export: a test that reads it, or coverage drops.
- Gated admin route: a test that VIEWER gets 403.
- Domain tests cover every branch (the floor is 100%).

## Commits

- Conventional Commits, header at most 100 characters, scopes from `commitlint.config.mjs`.
- One logical change per commit. The body says why.
- `pre-commit` runs lint-staged (ESLint fix + Prettier on staged files); `commit-msg` runs commitlint. Never bypass them.
