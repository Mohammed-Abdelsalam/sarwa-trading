---
description: Turn a request into a researched, reviewed plan and wait for approval before any code changes.
argument-hint: <request>
---

Plan this request for the Sarwa Mini Trading monorepo. Do not edit any file until the human approves the plan.

Request: $ARGUMENTS

## 1. Research

- Read `CLAUDE.md`, `.claude/rules/agent-rules.md`, `.claude/rules/conventions.md` and any ADR in `docs/adr/` that the request touches.
- Find the code involved: contracts schemas, domain rules, server modules, core hooks, app view-models. Cite `file:line` for every claim about current behaviour.
- If the request is ambiguous or product-heavy, run the `business-analyst` agent first and use its requirements and edge cases.
- Mark each finding **V** (verified in code, a test or a request) or **S** (suspected; needs a failing test before it is fixed).

## 2. Numbered plan

Order the steps by layer: contracts → domain → server → core → apps → docs. For each step:

```
N. <title>
   Files: <paths>
   Change: <what, in one or two lines>
   Test first: <the failing test, or "refactor: existing tests stay green">
   Gate: <workspaces to run>
   Commit: <type(scope): subject>
```

Group steps that can run in parallel worktrees, and give each group disjoint file ownership.

## 3. Review the plan

Run `architecture-reviewer` and `business-reviewer` on the draft in parallel (add `security-reviewer` when auth, cookies, PII or admin routes are involved). Fold verified findings into the plan; list rejected ones with a reason.

## 4. Risks

A short table: risk, likelihood, impact, mitigation (test, flag, rollback).

## 5. Open decisions for the human

Only questions that change scope, UX or architecture. For each: options, trade-off, and your recommendation.

## 6. Stop

End with "Waiting for approval." Do not start implementing.
