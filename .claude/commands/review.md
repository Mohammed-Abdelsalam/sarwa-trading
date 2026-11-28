---
description: Run the reviewer agents in parallel on a diff or plan and merge their verified findings into one ranked list.
argument-hint: '[base ref or plan file, default main]'
---

Review the target with independent reviewers, then merge.

Target: $ARGUMENTS (if empty, review `git diff main...HEAD` plus uncommitted changes)

## 1. Scope

- `git diff <base>...HEAD --stat` and `git status --short`. List the touched workspaces.
- Pick reviewers: always `code-reviewer` and `architecture-reviewer`. Add `security-reviewer` for auth, sessions, cookies, admin routes, input handling or PII. Add `performance-reviewer` for live-price UI, lists, sockets, queries or SSR pages. Add `business-reviewer` for user-facing flows or copy.

## 2. Run in parallel

Launch the chosen agents in one message. Give each the same base ref and file list, not your own opinions, so their reads stay independent.

## 3. Merge

- Deduplicate findings that point at the same root cause.
- Re-verify every critical and high finding yourself against the code. Drop anything that does not hold up and say why.
- Rank: critical (money, data loss, security) → high → medium → low.

## Output

```
## Verdict
<ready / fix then ready / rework>

## Findings
| # | Severity | Area | Finding | Where | Source agent | Verified |
|---|---|---|---|---|---|---|

## Proposed fixes (in order)
1. <failing test to add> → <fix> → <commit header>

## Dropped
- <finding> — <why it does not hold>
```

Do not fix anything. Wait for the human to choose which findings to act on.
