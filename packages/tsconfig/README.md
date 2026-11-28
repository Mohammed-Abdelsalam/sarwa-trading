# @sarwa/tsconfig

The shared TypeScript configs. Every workspace extends one of them, so strictness is the same everywhere.

## Use

The package has no scripts and no build. A workspace extends a config in its `tsconfig.json`:

```json
{ "extends": "@sarwa/tsconfig/pure.json" }
```

Type-check per workspace with `pnpm turbo run typecheck --filter=@sarwa/<ws>`, or `pnpm typecheck` at the root. The `typecheck` scripts run `tsc --noEmit`; web and admin run `next typegen` first, and mobile runs `expo customize tsconfig.json` first (its `typegen` script). tsup, Next.js, Metro and the Nest CLI produce the output.

## Files

| File                | Extends       | Used by                                                                                                                                                          |
| ------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strict.json`       | none          | Every config below: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, unused locals and parameters. |
| `base.json`         | `strict.json` | ES2022, ESNext modules, `Bundler` resolution, `verbatimModuleSyntax`, `isolatedModules`.                                                                         |
| `pure.json`         | `base.json`   | `domain`, `contracts`, `i18n`: no DOM and no JSX.                                                                                                                |
| `library.json`      | `base.json`   | `core`, `ui`, `tokens`: DOM libs and `react-jsx`.                                                                                                                |
| `nextjs.json`       | `base.json`   | `web`, `admin`: `jsx: preserve` and the Next plugin.                                                                                                             |
| `node.json`         | `strict.json` | `server`: `NodeNext` modules and decorator metadata for NestJS.                                                                                                  |
| `react-native.json` | `strict.json` | `mobile`, together with `expo/tsconfig.base`.                                                                                                                    |

See the [root README](../../README.md), [architecture](../../docs/architecture.md), and ADR [0001](../../docs/adr/0001-monorepo-pnpm-turborepo.md).
