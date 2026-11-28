# @sarwa/i18n

Typed English and Arabic copy, plus locale-aware formatting. It holds the customer catalogs, a separate admin catalog (so customer apps never ship dashboard copy), the order rejection messages, and number, money and date formatters with Latin or Arabic digits. It is framework-free. The apps get it through `@sarwa/core`.

## Run, test, build

| Task                      | In this folder                | From the root                                        |
| ------------------------- | ----------------------------- | ---------------------------------------------------- |
| Build to `dist/` (tsup)   | `pnpm build`                  | `pnpm turbo run build --filter=@sarwa/i18n`          |
| Watch                     | `pnpm dev`                    | runs as part of root `pnpm dev`                      |
| Test (95% coverage floor) | `pnpm test`                   | `pnpm turbo run test --filter=@sarwa/i18n`           |
| Lint / typecheck          | `pnpm lint`, `pnpm typecheck` | `pnpm turbo run lint typecheck --filter=@sarwa/i18n` |

Consumers import from `dist`, so rebuild this package after you change it. No port and no env.

## Structure

- `src/messages/en.ts`, `src/messages/ar.ts`: the customer catalogs. `en.ts` defines the `Messages` type, and `ar.ts` must match it.
- `src/messages/admin-en.ts`, `src/messages/admin-ar.ts`: the dashboard catalogs (`AdminMessages`).
- `src/catalog.ts`: `getMessages(locale)` and `getAdminMessages(locale)`.
- `src/locale.ts`: `LOCALES` (`en`, `ar`), `isRtl`, digit systems (`latn`, `arab`), plural rules.
- `src/format.ts`: `createFormatter` for prices, money, percentages, quantities and dates.
- `src/rejections.ts`: one formatter per `@sarwa/domain` rejection code. A new code does not compile until it has copy.
- `src/copy.ts`: shared copy types.
- `test/`: catalog parity and formatting tests.

## Boundaries

Only its own files and `@sarwa/domain` (lint-enforced). Its only consumer is `@sarwa/core`, which re-exports what the apps need.

New UI strings go into both the EN and AR catalogs and must work in RTL.

See the [root README](../../README.md), [architecture](../../docs/architecture.md), and ADR [0010](../../docs/adr/0010-arabic-and-rtl-first-class.md).
