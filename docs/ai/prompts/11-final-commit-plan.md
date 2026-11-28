# 11 — Final commit plan (fix/phase-0-hardening)

- **Base:** the last pushed commit is `afb73b5` (origin/fix/phase-0-hardening).
- **Change set:** 491 files (`git diff --name-only --no-renames afb73b5..HEAD`).
- **Result:** 12 commits instead of more than 160 local commits and merges.

## 0) Unwind (Claude runs this after the final gate passes)

```powershell
git branch backup/pre-squash
git reset --soft afb73b5
git reset
```

All changes stay in the files; nothing is lost. `backup/pre-squash` is there to compare against at the end.

## 1) Commits — run them in this order, one line at a time

```powershell
git add -A pnpm-lock.yaml apps/server/package.json apps/mobile/package.json packages/ui/package.json; git commit -m "chore(deps): add argon2, ua-parser-js, expo-device and node types"
git add -A packages/contracts packages/domain packages/i18n ':!packages/domain/src/money.ts' ':!packages/domain/test/money.test.ts' ':!packages/i18n/src/format.ts' ':!packages/i18n/test/format.test.ts'; git commit -m "feat(contracts,domain,i18n): add customer account schemas, rules and copy"
git add -A apps/server; git commit -m "feat(server): add customer accounts, sessions, admin customers, invites and guest watchlists"
git add -A packages/core ':!packages/core/src/admin/forms.ts' ':!packages/core/test/admin/forms.test.ts'; git commit -m "feat(core): add auth, session and guest gating hooks"
git add -A packages/ui; git commit -m "feat(ui): share the csp builder, locale cookie and auth form primitives"
git add -A apps/web ':!apps/web/src/features/watchlist' ':!apps/web/test/features/watchlist'; git commit -m "feat(web): add sign-in, sign-up, account settings and guest gating"
git add -A apps/mobile ':!apps/mobile/src/features/watchlist' ':!apps/mobile/test/features/watchlist' ':!apps/mobile/test/features/gating/guest-star.test.tsx' ':!apps/mobile/src/components/trading/keypad.tsx' ':!apps/mobile/test/components/trading/keypad.test.tsx' ':!apps/mobile/src/components/ui/trailing-swipeable.tsx' ':!apps/mobile/src/features/portfolio/position-row.tsx' ':!apps/mobile/test/features/portfolio/portfolio-screen.test.tsx' ':!apps/mobile/src/features/stock-detail/price-chart.tsx' ':!apps/mobile/test/features/stock-detail/price-chart.test.tsx'; git commit -m "feat(mobile): add auth screens, account settings and guest gating"
git add -A apps/admin; git commit -m "feat(admin): replace accounts and users with customers, team, invites and a language switch"
git add -A apps/web/src/features/watchlist apps/web/test/features/watchlist apps/mobile/src/features/watchlist apps/mobile/test/features/watchlist apps/mobile/test/features/gating/guest-star.test.tsx; git commit -m "feat(web,mobile): let guests keep a watchlist without an account"
git add -A apps/mobile; git commit -m "fix(mobile): keep the keypad, chart axis and swipe rows left to right in arabic"
git add -A packages/domain packages/core packages/i18n; git commit -m "fix(domain,core,i18n): accept arabic digits in amounts and show future relative times"
git add -A .github package.json; git commit -m "ci: run the shared test:coverage script so coverage floors match local"
```

| #   | Contents                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------- |
| 1   | lockfile plus the new dependencies                                                                         |
| 2   | account schemas, rules and copy, and guest watchlist copy                                                  |
| 3   | the whole server: accounts, sessions, admin customers, invites, the guest device account, IP and CSP fixes |
| 4   | core: session, auth, gating, the watchlist for guests, session renewal and server errors                   |
| 5   | ui: the shared CSP builder, the locale cookie and form primitives                                          |
| 6   | web: auth pages, settings, guest flows, the proxy and CSP, the favicon, refresh after a language switch    |
| 7   | mobile: auth screens, account, gating, SecureStore, the order-ticket fix                                   |
| 8   | admin: Customers, Team, invites, audit filter, CSP, language switch, favicon                               |
| 9   | guest watchlist screens on web and mobile                                                                  |
| 10  | mobile RTL fixes: keypad, chart axis, swipe rows                                                           |
| 11  | Arabic digits in amounts, and future relative times                                                        |
| 12  | CI uses `test:coverage`                                                                                    |

## 2) Check after the commits

```powershell
git status --short
git diff --stat backup/pre-squash HEAD
git log --oneline afb73b5..HEAD
```

- `git status --short` must print nothing.
- `git diff backup/pre-squash HEAD` must print nothing (or only formatting changes made by prettier).
- The log must show 12 commits.
- Then run a normal `git push`; no force needed.
