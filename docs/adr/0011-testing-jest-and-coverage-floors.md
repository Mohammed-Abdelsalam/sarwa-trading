# ADR 0011: Jest everywhere, with per-workspace coverage floors in CI

## Status

Accepted. Supersedes the original plan of Vitest everywhere with jest-expo only for mobile components.

## Context

The original plan used Vitest for packages, server and web, and jest-expo only for React Native components, because React Native is not reliably testable under Vitest. In practice that meant two runners, two mocking APIs, two config styles and two coverage tools in one repo. NestJS also needs decorator metadata at test time, which Vitest only gets through an extra plugin.

## Decision

- **Jest 30 in every workspace.**
  - `@sarwa/jest-config` provides a `node` preset and a `jsdom` preset. Both transform TypeScript with `@swc/jest` (fast, with legacy decorators and decorator metadata for Nest). Type checking runs separately in `typecheck`.
  - Mobile uses the `jest-expo` preset with React Native Testing Library.
  - DOM workspaces (core, ui, web, admin) use Testing Library for React and `jest-dom`.
  - Tests live in each workspace's `test/` folder.
- **Server tests are end-to-end on a real database:** Jest global setup builds a throwaway SQLite `test.db` with `prisma migrate deploy` and the seed, then suites drive the app with supertest and `socket.io-client`. They run with `--runInBand`.
- **No browser end-to-end suite** (no Playwright or Cypress). Logic lives in core and domain, where it is unit tested; apps test their view-models and render-only components.
- **Coverage floors per workspace**, in each `jest.config.js` (`coverageThreshold.global`):

  | Workspace | Statements | Branches | Functions | Lines |
  | --------- | ---------- | -------- | --------- | ----- |
  | domain    | 100        | 100      | 100       | 100   |
  | contracts | 95         | 95       | 95        | 95    |
  | i18n      | 95         | 95       | 95        | 95    |
  | ui        | 84         | 66       | 78        | 89    |
  | core      | 80         | 75       | 80        | 80    |
  | web       | 65         | 52       | 56        | 66    |
  | admin     | 60         | 49       | 44        | 62    |
  | mobile    | 53         | 49       | 55        | 54    |

  The server and tokens have no floor.

- **CI runs the same script developers run:** `pnpm test:coverage` (`turbo run test -- --coverage --ci`), so a floor fails locally before it fails in CI. Coverage reports (`lcov`) are uploaded as an artifact.
- **Every bug fix starts with a failing test.**

**Lesson recorded: swc getters.** swc compiles every `export const` into a getter on the module. A constant or schema that no test reads is an uncovered statement, which broke CI once when domain fell just under 100%. The rule: every new export gets a real test that uses it. No blanket "import everything" test, and no lowered threshold.

## Why

- One runner, one mocking API and one coverage tool across server, packages, web and mobile.
- swc keeps Jest fast and supports Nest decorators without extra plugins.
- Floors that match each layer's role: pure rules must be fully covered; UI layers have lower but enforced floors.
- Unit tests on shared logic catch most bugs at a fraction of the cost of browser tests.

## Alternatives considered

- **Vitest plus jest-expo (the original plan):** faster watch mode, but two runners and two configs.
- **One global coverage threshold:** simpler, but too low for domain or too high for apps.
- **Playwright or Detox end-to-end suites:** strongest confidence, but slow and flaky in CI for a project this size.

## Consequences

- Good: consistent tooling; CI and local runs agree; regressions in shared logic are caught early.
- Bad: Jest is slower than Vitest, and the first jest-expo render under coverage is slow (mobile sets a 20-second test timeout).
- Bad: no test drives a real browser or device, so integration issues between the Next rewrite, cookies and the API are found by manual checks, not CI.
- Bad: the server has no percentage floor; its safety comes from the e2e suites.
- Bad: the swc getter rule adds friction: a new exported constant needs a test even when it is trivial.
