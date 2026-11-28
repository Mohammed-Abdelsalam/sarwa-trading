# @sarwa/tokens

The design system as data, and the single source of colours and type for every client. It defines light and dark colour roles, sector colours, typography, spacing, radius, shadows, motion and breakpoints, plus component sizes and variants. It generates the CSS variables for web and admin and a Tailwind preset for mobile.

These values come from the project's design system: see the [full UI kit (PDF)](../../docs/design/mini-trading-ui-kit.pdf) and the [Design and design system](../../README.md#design-and-design-system) section of the root README.

## Run, test, build

| Task                                       | In this folder                | From the root                                          |
| ------------------------------------------ | ----------------------------- | ------------------------------------------------------ |
| Build (tsup, then `scripts/build-css.mjs`) | `pnpm build`                  | `pnpm turbo run build --filter=@sarwa/tokens`          |
| Watch                                      | `pnpm dev`                    | runs as part of root `pnpm dev`                        |
| Test                                       | `pnpm test`                   | `pnpm turbo run test --filter=@sarwa/tokens`           |
| Lint / typecheck                           | `pnpm lint`, `pnpm typecheck` | `pnpm turbo run lint typecheck --filter=@sarwa/tokens` |

The build writes `dist/index.*`, `dist/tailwind-preset.*`, `dist/theme.css` and `dist/native.css`. Consumers import from `dist`, so rebuild this package after you change a token. No port and no env.

## Entry points

- `@sarwa/tokens`: token objects, `themes`, `themeVariables()`, contrast helpers.
- `@sarwa/tokens/theme.css`: CSS variables (prefix `--sarwa-`), imported by `apps/web` and `apps/admin` in `globals.css`.
- `@sarwa/tokens/tailwind-preset`: the Tailwind preset used by `apps/mobile/tailwind.config.js`.
- `@sarwa/tokens/native.css`: a native variant of the theme CSS.

## Structure

- `src/colors.ts`: colour roles, light and dark themes, sector colours, contrast checks.
- `src/scale.ts`: font families, typography, spacing, radius, shadows, motion, breakpoints, layout.
- `src/components.ts`: button and other component variants and sizes.
- `src/css.ts`: `buildWebThemeCss`, `buildNativeThemeCss`, `cssVarName`.
- `src/tailwind-preset.ts`: maps the tokens onto Tailwind theme keys.
- `scripts/build-css.mjs`: writes the two CSS files from the built JS.
- `test/`: colour contrast, component and CSS tests.

## Boundaries

`tokens` depends on no other workspace package and follows the shared base rules (no deep imports, no app imports). Components in the apps and in `@sarwa/ui` must take colours and fonts from here: lint rejects hex literals and font-file names.

See the [root README](../../README.md), [architecture](../../docs/architecture.md), and ADR [0003](../../docs/adr/0003-share-logic-not-ui.md), which explains why tokens are shared while view components are not.
