---
description: Brief the live-verifier agent to prove a change end to end on production builds with a throwaway database.
argument-hint: <feature or scenarios to verify>
---

Verify live: $ARGUMENTS

1. Confirm the gate is green first (`/gate`). Do not verify a red build.
2. Write the scenario list from the plan's acceptance criteria. Each scenario has: actor (guest, customer, ADMIN, VIEWER), platform (web, admin), steps, expected result. Include at least one failure path (rate limit, VIEWER 403, market closed, revoked session) and one Arabic RTL check at 360 px.
3. Launch the `live-verifier` agent with this brief:

```
Goal: verify <feature> on production builds at commit <sha>.
Worktree: <path>. Read CLAUDE.md and .claude/agents/live-verifier.md.
Ports: server 4011, web 3011, admin 3012 (never 3000, 3001, 4000).
Database: throwaway file under apps/server/prisma, migrated and seeded, deleted at the end.
Scenarios:
  1. <actor> on <platform>: <steps> → expect <result>
  ...
Do not edit tracked files. Do not commit.
Report: the environment, pass/fail table with evidence, failures with repro, cleanup confirmation.
```

4. When it returns, check its cleanup section: no leftover processes on the ports, no leftover `.db` files (`git status --short --ignored apps/server/prisma`).
5. Turn each failure into a failing test plus a fix in the plan; do not patch it silently.
