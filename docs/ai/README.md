# AI workflow

How this repo was built with AI: the process, the rules, what went wrong, and the real prompts. The committed agent setup (`CLAUDE.md`, `.claude/`) lives at the repo root; this folder explains how it was used.

## The approach in five lines

1. **Learn first.** React Native and NestJS were new to me: video courses for the foundations, then AI as a tutor for the gaps, in the context of this project. Each part was learned before it was built.
2. **Plan, then decide.** The AI researches, specs and reviews; the human reviews the plan and makes every product and architecture decision.
3. **One coordinator, many workers.** The main session plans, briefs, merges and verifies; implementer agents work in parallel, each in its own git worktree with an explicit file scope and written hand-off contracts.
4. **Trust the gate, not the agent.** Typecheck, lint, tests with coverage and build decide; live checks on production builds catch what mocks can't; review findings are verified before they are fixed.
5. **The human owns history.** Agent commits are temporary; the human curates them into a short series of reviewed commits and pushes.

All project artifacts (prompts, plans, agent briefs, rules, decisions, ADRs, commit messages) are kept in the repo.

## Files

| File                                   | Read it for                                                                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [WORKFLOW.md](WORKFLOW.md)             | The loop, stage by stage: what the AI did, what the human did, the artifact, a real example. Also the coordinator + workers model. |
| [BEST-PRACTICES.md](BEST-PRACTICES.md) | The practices that held up, each with why and an example from this project.                                                        |
| [LESSONS.md](LESSONS.md)               | Incidents and the rule each one added.                                                                                             |
| [LEARNING.md](LEARNING.md)             | How the AI was used as a teacher before building, and which decisions that learning informed.                                      |
| [prompts/index.md](prompts/index.md)   | The real prompts, plans, decisions and briefs, in timeline order.                                                                  |
