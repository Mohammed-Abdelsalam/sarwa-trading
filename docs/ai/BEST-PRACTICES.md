# Best practices

What held up across this project. Each one has the reason and where it showed up. The prompts referenced are in [prompts/](prompts/index.md).

### 1. Use AI to learn unfamiliar areas first

- **Why:** you can't review code you don't understand, and an AI that writes code you can't judge is a liability, not leverage.
- **Here:** React Native and NestJS were new to me. Video courses gave the foundations, AI filled the gaps as a tutor, and each part was built right after it was learned. See [LEARNING.md](LEARNING.md).

### 2. Plan before code

- **Why:** a plan is cheap to change; a merged diff isn't. Writing it down also exposes the questions that need a human.
- **Here:** a spec and milestones M0–M9 before the first line; a written design spec with gaps G1–G30 ([05](prompts/05-accounts-design-spec.md)) before any accounts code; a phased master plan ([04](prompts/04-master-plan.md)) before the refactor.

### 3. The human owns decisions

- **Why:** the AI is good at options and trade-offs, but product and architecture choices need an owner who will defend them.
- **Here:** Jest instead of Vitest, a real database instead of mocks, a full admin dashboard, VIEWER sees masked PII, the guest landing matches on web and mobile. Each is recorded ("User decisions" in 04, [07](prompts/07-wave2-decisions.md), "Already decided" in [agent-rules.md](prompts/agent-rules.md)) so no agent reopens it.

### 4. Roles, not one big agent

- **Why:** one agent doing research, design, implementation and review grades its own work and drowns in context.
- **Here:** a coordinator that plans, briefs, merges and verifies; implementer agents per area; read-only reviewers with a fresh context; writer agents for the handbook. See "Coordinator + workers" in [WORKFLOW.md](WORKFLOW.md).

### 5. A brief is a contract

- **Why:** a worker only knows what it is told. Vague briefs produce scope creep and guesses.
- **Here:** every brief had the same parts: goal, context, worktree, owned vs forbidden files, rules file, gate, report format ([template](prompts/agent-brief-template.md), [real example](prompts/brief-example-guest-watchlist-server.md)).

### 6. Isolation per worktree

- **Why:** parallel agents in one checkout overwrite each other's files and test runs.
- **Here:** each worker had its own git worktree and branch. The coordinator merged branches one at a time and re-ran the gate after each.

### 7. File ownership

- **Why:** worktrees isolate checkouts, not intent. Two agents can still change the same file on two branches and leave a conflict.
- **Here:** each brief lists the files the agent owns and the ones it must not touch. When an agent tried to edit outside its scope, permission checks blocked it and the rule is: report it, don't do it.

### 8. Hand-off contracts between agents

- **Why:** without them, consumers wait for producers or guess their API.
- **Here:** the core agent wrote [08-client-integration-guide.md](prompts/08-client-integration-guide.md) and the server agent wrote [09-server-api-notes.md](prompts/09-server-api-notes.md). Web, mobile and admin agents then built in parallel against those documents.

### 9. A failing test first

- **Why:** it proves the bug exists, proves the fix works, and keeps it fixed.
- **Here:** a hard rule in 04 and in agent-rules. 02 required the "cash goes negative" repro as both a domain test and a server e2e test. In the final review, all six real bugs were fixed test-first.

### 10. Verify claims before fixing

- **Why:** reviewers, human or AI, are sometimes wrong. Fixing a false finding adds risk and churn for nothing.
- **Here:** 04 tags each finding V (verified) or S (suspected, prove it with a failing test first). 02 lists only items re-checked on the final tree. In the independent review, one sub-claim proved false and was skipped.

### 11. The gate is the source of truth, not an agent's word

- **Why:** an agent can report "all green" in good faith and be wrong: wrong filter, wrong workspace, stale build.
- **Here:** every worker report had to include exact gate numbers, and the coordinator re-ran the gate itself after each merge. CI runs the same `test:coverage` script developers run.

### 12. Live verification for what mocks can't see

- **Why:** unit tests with mocks don't exercise the production build, server components, rewrites or headers.
- **Here:** a real browser against production builds found two production-only bugs that mocked tests missed ([the story](WORKFLOW.md#10-live-verification)), and the guest first load was made fast after it was measured live ([Lighthouse results](../performance/lighthouse/README.md)).

### 13. Scope discipline: suggestions are listed, not built

- **Why:** unrequested improvements make diffs harder to review and collide with other agents.
- **Here:** every worker report has a section for "found but left out of scope". The coordinator turns those into the next plan, or drops them.

### 14. A single final gate

- **Why:** per-workspace gates can all pass while the whole repo doesn't (cross-package types, build order, coverage floors).
- **Here:** before the release, one full run of typecheck, lint, `test:coverage` and build across the monorepo, after all merges and before any human commit.

### 15. Rules evolve from incidents

- **Why:** a rule written after a real failure is specific and gets followed; a rule invented up front is often neither.
- **Here:** `agent-rules.md` gained "never stash", "private temp file for commit messages", "filter before `--`" and "every export needs a test" from real incidents. See [LESSONS.md](LESSONS.md).

### 16. The human curates history and pushes

- **Why:** history is for reviewers. Many small agent commits and merges describe how agents worked, not what changed.
- **Here:** agents commit locally and never push. The coordinator proposes a commit plan; it is simulated on a temporary git index so each file lands in exactly one commit, with a backup branch to diff against. The human runs the commits and pushes ([06](prompts/06-commit-plan.md): 8 commits for wave 1; [11](prompts/11-final-commit-plan.md): 12 commits for the release).
