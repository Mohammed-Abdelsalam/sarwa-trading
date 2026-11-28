# Commit plan (8 commits): run them in order

- Branch: `fix/phase-0-hardening`, based on main `dd374ca`.
- Backup of the original commits: branch `backup/wave1-commits`.
- Checked by a dry run: the 8 commits cover all 394 files and match the backup.
- Checked: all 8 messages pass commitlint.

### 1

```
git add -A -- .github turbo.json package.json packages/ui/jest.config.js apps/web/jest.config.js apps/admin/jest.config.js apps/mobile/jest.config.js packages/eslint-config packages/tsconfig packages/domain/tsconfig.json packages/contracts/tsconfig.json packages/i18n/tsconfig.json packages/core/eslint.config.mjs apps/web/eslint.config.mjs apps/admin/eslint.config.mjs apps/mobile/eslint.config.mjs
git commit -m "chore(ci,config): cache CI through turbo and enforce shared-logic boundaries" -m "turbo.json declares env and ignores docs; CI caches .turbo, sets GIT_SHA, never cancels main." -m "Adds dependabot, a PR template, Node 22.x engines and coverage floors per app." -m "Lint stops app hooks importing React Query; pure packages compile without DOM types."
```

### 2

```
git add -A -- packages/domain packages/contracts packages/i18n
git commit -m "feat(domain,contracts,i18n): add shared rules, typed routes and errors, and one copy catalog" -m "Domain gains order progress, realized P&L, today's activity and the symbol_disabled reason." -m "Contracts add MARKET_ROUTES, a typed ErrorCode, account.reset and the new audit actions." -m "i18n holds notFound/errorPage once, adds currency and digit helpers, splits admin copy."
```

### 3

```
git add -A -- packages/core packages/ui
git commit -m "refactor(core,ui): share order, ticket, alert and market logic and browser helpers" -m "Web and mobile duplicated this logic and drifted; mobile said Canceled by you for any cancel." -m "createSarwaClient wires every app, with an auth slot, identityStorage and a split ApiClient." -m "ui hosts theme, CSV and security headers; Table and heatmap become responsive."
```

### 4

```
git add -A -- apps/server/prisma apps/server/.env.example apps/server/src/env.ts apps/server/src/common apps/server/src/main.ts apps/server/src/app.module.ts apps/server/src/health.controller.ts apps/server/src/admin apps/server/test/env.test.ts apps/server/test/seed.test.ts apps/server/test/common
git commit -m "fix(server): harden admin auth, mask PII for viewers and add shared infrastructure" -m "Sign-out revokes tokens, five wrong passwords lock an account, cross-site admin writes fail." -m "VIEWER sees masked emails and IPs; production refuses weak secrets and demo passwords." -m "Adds an event bus, JSON logs, health probes, indexes and thin admin controllers."
```

### 5

```
git add -A -- apps/server
git commit -m "perf(server): batch account valuation and notices and fix order edge cases" -m "The admin accounts list returned 500 after 5 s because each account opened a transaction." -m "Books, snapshots and notices are batched; disabling a stock cancels its orders." -m "Modify keeps the expiry, shutdown drains the queue and e2e tests are deterministic."
```

### 6

```
git add -A -- apps/web
git commit -m "feat(web): add SEO, a nonce CSP and responsive, accessible layouts" -m "Metadata, social cards, JSON-LD, robots, sitemap and real 404s; personal pages are noindex." -m "proxy.ts sends a per-request CSP nonce; layouts switch by CSS, so the page never shifts."
```

### 7

```
git add -A -- apps/admin
git commit -m "feat(admin): make the dashboard responsive, keep list state in the URL and add headers" -m "Below lg the sidebar is a drawer; tables scroll; filters, sort and page live in the URL." -m "Sends security headers and a disallow-all robots.txt; tests hit a fake server, not hooks."
```

### 8

```
git add -A -- apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): secure the device identity, add deep links and EAS, and share core logic" -m "The device id lives in SecureStore and only an allow-list of queries is persisted." -m "The stock route is /stocks with universal links; maintenance is an overlay; adds eas.json." -m "Lists use FlashList, only background pauses the socket, and a11y targets reach 44 pt."
```

### After

```
git status
git log --oneline -8
```
