# Lessons

Things that went wrong while working with agents, and the rule each one added. Most of these rules now live in [agent-rules.md](prompts/agent-rules.md), the repo scripts or the hooks.

| Incident                                                                                                                                              | Rule added                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coverage passed locally and failed in CI. swc compiles every `export const` to a getter, so an export no test reads counts as an uncovered statement. | Run `pnpm test:coverage` locally, the same script CI runs. Every new export gets a test that uses it.                                                   |
| A `--filter` placed after `--` was passed to jest instead of turbo, so the "gate" ran something other than intended.                                  | The filter goes before `--`: `cmd /c "pnpm turbo run test --filter=<ws> -- --coverage --ci"`.                                                           |
| Two agents wrote their commit messages to the same temp file and committed each other's messages.                                                     | Each agent uses a private, uniquely named temp file for commit messages.                                                                                |
| `git stash` is shared by every worktree of a repo; one agent's `pop` applied another agent's entry.                                                   | Never stash. To prove a test fails without the fix, comment the fix out or commit and revert. The incident was detected and verified: nothing was lost. |
| lint-staged exceeded the Windows command-line length limit when many files were staged.                                                               | The pre-commit hook runs `lint-staged --max-arg-length 4000`.                                                                                           |
| Commit commands run out of order swept files into the wrong commit.                                                                                   | The commit plan has a fixed order and is simulated on a temporary git index first, proving each file lands in exactly one commit.                       |
| Mocked tests were green while production had an RSC 500 on every settings page and an empty SSR snapshot.                                             | A live verification step: a real browser against production builds, through the real rewrites.                                                          |
| Agents tried to edit files outside their scope and were blocked by permission checks.                                                                 | Don't work around it: report what is needed outside your scope, and the coordinator decides.                                                            |
| A reviewer's claim proved partly false.                                                                                                               | Verify every finding (reproduce it, ideally as a failing test) before fixing.                                                                           |

## What the table doesn't show

- **Most failures were in coordination, not in code.** Shared git state (stash, temp files, commit order) caused more trouble than any single bug. Worktrees isolate the checkout, not the repository.
- **"Green" needs a definition.** Two incidents above are a gate that looked green but wasn't the gate CI runs. The fix was one shared script, not more care.
- **Agents follow rules they can read.** Each rule was added to the file every worker reads first, phrased as an instruction with the reason, so the next agent didn't repeat the incident.
