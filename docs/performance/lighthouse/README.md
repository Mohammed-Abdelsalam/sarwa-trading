# Lighthouse results

Lighthouse was run by hand, locally, against **production builds** (`next build` + `next start`) with the API running. It is not part of CI.

| Page                           | Form factor | Perf | A11y | Best practices | SEO |
| ------------------------------ | ----------- | ---- | ---- | -------------- | --- |
| `/` before the guest fast path | mobile      | 81   | 100  | 92             | 100 |
| `/` after the guest fast path  | mobile      | 93   | 100  | 96 → **100**   | 100 |
| `/`                            | desktop     | 100  | 100  | 96 → **100**   | 100 |
| `/stocks/AAPL`                 | mobile      | 98   | 100  | 92             | 100 |
| `/stocks/AAPL`                 | desktop     | 100  | 100  | 92             | 100 |
| `/login` (admin)               | mobile      | —    | —    | **100**        | —   |

The stock page was measured before the CSP and console fixes listed below, so its best-practices score was not re-run afterwards. The admin `/login` run was measured manually after the favicon fix; only its best-practices score was recorded, so a dash means that score wasn't recorded.

## What moved the numbers

- **Mobile LCP went from 4.5 s to 0.8 s.**
  - A guest with no session cookie now settles immediately, so there is no `/me` or `/auth/refresh` round trip.
  - The guest hero is rendered in the server HTML.
  - Details are in [`docs/performance.md`](../../performance.md).
- **Best practices went from 92 to 100.**
  - Guests no longer hit 401 and 403 console errors.
  - Zod runs in jitless mode, so the strict nonce CSP sees no `eval` probe.

## Reproduce

1. Build the apps for production, then start the API, web and admin.
2. Run `npx lighthouse http://localhost:3000/ --view` for mobile (the default), or add `--preset=desktop` for desktop.
