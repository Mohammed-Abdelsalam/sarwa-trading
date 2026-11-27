## What and why

<!-- One or two lines: the change and the reason. Link the issue if there is one. -->

## How it was tested

<!-- Tests added or updated, and any manual checks (web at 360/768/1024/1280, mobile, EN + AR/RTL). -->

## Checklist

- [ ] `pnpm turbo run lint typecheck test --filter=<workspace>...` is green
- [ ] Bug fixes start with a test that failed first
- [ ] New UI strings are in `@sarwa/i18n` (EN and AR) and work in RTL
- [ ] No secrets, `.env` or `*.db` files committed
