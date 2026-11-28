---
description: Write a complete brief for a subagent (usually the implementer) so it can work alone in its own worktree.
argument-hint: <plan step(s) to delegate>
---

Write a subagent brief for: $ARGUMENTS

A subagent knows only what the brief says. Fill every section; if you cannot, the task is not ready to delegate.

```
# Brief: <short title>

## Goal
<one paragraph: the outcome, not the steps>
Acceptance:
- <observable check>

## Context
- Read first: CLAUDE.md, .claude/rules/agent-rules.md, .claude/rules/conventions.md, <relevant ADRs>.
- Current behaviour: <file:line facts>.
- Already ruled out / decided: <so it does not re-investigate or reopen>.

## Workspace
- Worktree: <path>   Branch: <name>   Base: <sha>
- Setup: pnpm install --frozen-lockfile; build domain, i18n, contracts, tokens; prisma generate if server.

## Files
Owned (may edit):
- <path or glob>
Forbidden (another agent owns them, or out of scope):
- <path or glob>
If you need a forbidden change, report it; do not make it.

## Rules
- Failing test first for every bug fix.
- Small local commits, Conventional Commits, header at most 100 characters, scope from commitlint.config.mjs.
- Commit message in a private temp file named <branch>-<random>.txt.
- Never push, stash, --no-verify, prisma migrate reset, --force-reset or db:reset.
- No .env or *.db in commits. Stop any server you start.
- EN and AR strings for any new UI copy.

## Gate (before the final report)
cmd /c "pnpm turbo run test --filter=<ws> -- --coverage --ci"
pnpm turbo run typecheck lint --filter=<ws>

## Report
- Branch and git log --oneline <base>..HEAD
- One line per commit
- Gate table: workspace, tests, coverage, typecheck, lint
- Gaps and out-of-scope findings
```

When several briefs run in parallel, check that their owned-file lists do not overlap before launching them.
