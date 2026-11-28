# Agent brief template

Every implementer agent got a brief with this structure, plus [agent-rules.md](agent-rules.md). The brief is a contract: if it isn't in the brief, the agent doesn't build it. Anything the agent finds outside its scope goes in its report, not in its diff.

A filled-in example: [brief-example-guest-watchlist-server.md](brief-example-guest-watchlist-server.md).

---

```markdown
# <Short task name>

## Goal

One or two sentences: the behaviour that must exist when you finish, and why (the product or review reason).

## Context

- What already exists and where (files, hooks, endpoints). Link the plan section, the spec gaps (G-numbers)
  and the decisions file that apply.
- What other agents are doing right now, so you know what not to touch.
- Decisions already taken that you must not reopen.

## Workspace

- Worktree: `<path of your own git worktree>`, branch `<branch>`, based on `<commit>`.
- Setup: follow "Setup" in agent-rules.md (install, build the shared packages, generate Prisma if needed).

## Files

- **You own:** `<globs>` — create and change freely.
- **Read-only for you:** `<globs>` — you may import from them; if you need a change, report it.
- **Forbidden:** everything else, including other agents' areas, `.env`, `*.db`, lockfile changes unless listed.

## Work items

1. <Item> — expected behaviour, edge cases, error codes.
2. ...
   Each bug fix starts with a test that fails first.

## Tests that must exist

- <describe / it names, or the cases they cover>

## Rules

Read and follow `agent-rules.md` fully. In short: local commits only, never push, never stash,
private temp file for commit messages, no `--no-verify`, failing test first, coverage is part of the gate.

## Gate (must be green before you report)

- `pnpm turbo run typecheck lint test --filter=<ws>...`
- `cmd /c "pnpm turbo run test --filter=<ws> -- --coverage --ci"` (filter before `--`)

## Report (your last message)

- Branch and `git log --oneline <base>..HEAD`.
- One line per commit: what changed.
- Anything found but left out of scope, and any file outside your scope you needed.
- Exact gate results: test counts, typecheck, lint, coverage.
```
