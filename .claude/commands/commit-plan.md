---
description: Curate uncommitted local work into a short series of Conventional Commits, simulated on a temporary index before anything is committed.
argument-hint: '[extra guidance, e.g. "split server and core"]'
---

Turn the current uncommitted work into a clean commit series. Guidance: $ARGUMENTS

Never push. Never use `git stash`. Never commit `.env`, `.env.*` (except `.env.example`) or `*.db`.

## 1. Inventory

- `git status --porcelain=v1 -uall` gives the full list of changed, deleted and untracked paths. Save it as the master list.
- Flag and exclude anything that must not be committed (env files, databases, coverage, build output, scratch files).

## 2. Group by layer

Order: `repo`/`config`/`ci` → `contracts` → `domain` → `i18n`/`tokens` → `server` → `core` → `ui` → `web`/`admin`/`mobile` → `docs`/`ai`. Within a layer, split by logical change. Keep a test in the same commit as the code it covers, so every commit passes its own gate. Aim for a short series; do not split a change that only makes sense whole.

For each commit write: header (Conventional Commits, at most 100 characters, scope from `commitlint.config.mjs`, lower-case subject), a one-to-three-line body that says why, and its exact path list.

## 3. Simulate on a temporary index

Do not touch the real index while planning. In Bash:

```
export GIT_INDEX_FILE="$(mktemp -u)-commit-plan.idx"
git read-tree HEAD
git add -- <paths of commit 1>
git diff --cached --stat
...
unset GIT_INDEX_FILE
```

Check that:

- every path in the master list appears in **exactly one** commit (none missing, none twice), apart from the excluded ones;
- no excluded path is staged;
- each commit's paths form a coherent change (imports resolve against earlier commits).

Delete the temporary index file afterwards.

## 4. Present

```
| # | Header | Paths | Why |
|---|---|---|---|

Excluded: <paths and reason>
Coverage check: <n> paths, each assigned once — OK
```

Wait for approval. On approval, for each commit: `git add -- <paths>`, write the message to a private temp file (`<branch>-<random>.txt`), `git commit -F <file>`, and let the hooks run. If a hook fails, fix the cause and retry; never `--no-verify`. Finish with `git log --oneline` and `git status --short`.
