---
description: Run the full quality gate (format, lint, typecheck, coverage tests, build) and report exact results.
argument-hint: '[workspace filter, e.g. @sarwa/core; empty = whole repo]'
---

Run the gate for: $ARGUMENTS (empty means the whole repo, the same as CI).

Run pnpm from PowerShell. Stop no other process and change no file; this command only reports.

## Whole repo (mirrors `.github/workflows/ci.yml`)

1. `pnpm exec turbo run build --filter=@sarwa/tokens`
2. `pnpm format:check`
3. `pnpm exec turbo run lint typecheck build`
4. `pnpm test:coverage`

## One workspace

1. `pnpm turbo run typecheck lint --filter=<ws>`
2. `cmd /c "pnpm turbo run test --filter=<ws> -- --coverage --ci"` (the filter goes before `--`; `cmd /c` stops the PowerShell pnpm shim from swallowing `--`)
3. `pnpm turbo run build --filter=<ws>` if the workspace has a `build` script.

## On failure

Read the first real error, not the turbo summary. Name the file and the cause. For a coverage failure, name the uncovered exports (swc getters: an export no test reads counts as uncovered). Do not fix unless asked.

## Report

```
| Step | Result | Detail |
|---|---|---|
| format | PASS/FAIL | |
| lint | PASS/FAIL | <errors per workspace> |
| typecheck | PASS/FAIL | |
| test | PASS/FAIL | <suites/tests passed per workspace> |
| coverage | PASS/FAIL | <workspace: stmt/branch/fn/line vs floor> |
| build | PASS/FAIL | |

Failures: <file:line — cause>
```
