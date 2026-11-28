# @sarwa/jest-config

The shared Jest presets. Tests are compiled with SWC (`@swc/jest`): it strips types and handles decorators for NestJS, and type checking runs separately in `typecheck`.

## Use

The package has no scripts and no build. A workspace spreads a preset into its `jest.config.js` and adds a `displayName` and, except for server and tokens, a `coverageThreshold`:

```js
module.exports = {
  ...require('@sarwa/jest-config/node'),
  displayName: 'domain',
  coverageThreshold: { global: { statements: 100, lines: 100, functions: 100, branches: 100 } },
};
```

Run tests per workspace with `pnpm turbo run test --filter=@sarwa/<ws>`, or `pnpm test` at the root. CI runs `pnpm test:coverage`. For one workspace with its coverage gate: `pnpm turbo run test --filter=@sarwa/<ws> -- --coverage --ci` (the filter must come before `--`).

## Files

- `node.js`: Node environment, the SWC transform, tests in `test/**/*.test.{ts,tsx}`, coverage from `src/` (not `index.ts`), `text-summary` and `lcov` reports. Used by server, domain, contracts, i18n and tokens.
- `jsdom.js`: `node.js` plus the jsdom environment, `setup-dom.js` and a CSS mock. Used by core, ui, web and admin.
- `setup-dom.js`: loads `@testing-library/jest-dom` matchers.
- `style-mock.js`: replaces CSS imports in tests.

Mobile does not use these presets. It uses `jest-expo` directly.

## Coverage note

SWC compiles each `export const` into a getter, so an export that no test reads counts as uncovered. Every new export needs a test that uses it.

See the [root README](../../README.md), [architecture](../../docs/architecture.md), and ADR [0011](../../docs/adr/0011-testing-jest-and-coverage-floors.md).
