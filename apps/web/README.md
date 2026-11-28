# @sarwa/web

The customer web app, built with the Next.js 16 App Router and Tailwind v4. Guests can browse markets and star stocks. Signed-in customers trade, manage alerts and see their portfolio. Prices stream live over Socket.IO.

## Run, test, build

| Task               | In this folder                                                | From the root                                       |
| ------------------ | ------------------------------------------------------------- | --------------------------------------------------- |
| Dev on port 3000   | `pnpm dev`                                                    | `pnpm turbo run dev --filter=@sarwa/web`            |
| Test (Jest, jsdom) | `pnpm test`                                                   | `pnpm turbo run test --filter=@sarwa/web`           |
| Build / start      | `pnpm build`, then `pnpm start`                               | `pnpm turbo run build --filter=@sarwa/web`          |
| Lint / typecheck   | `pnpm lint`, `pnpm typecheck` (both run `next typegen` first) | `pnpm turbo run lint typecheck --filter=@sarwa/web` |

The API must be running on port 4000. `pnpm dev` at the root starts everything.

## Env

- `API_URL`: where the `/api/*` and `/socket.io/` rewrites in `next.config.ts` send requests, and the base URL for server-side fetches. It defaults to `NEXT_PUBLIC_API_URL`, then `http://localhost:4000`.
- `NEXT_PUBLIC_API_URL`: the API origin allowed in the CSP `connect-src`, used by `src/proxy.ts`.
- `NEXT_PUBLIC_SITE_URL`: the canonical URL for SEO, the sitemap and OG images (default `http://localhost:3000`).

The browser calls the API on its own origin through the rewrites, so the httpOnly session cookies stay first-party and need no CORS.

## Structure

- `src/app/`: routes (markets, `stocks/[symbol]`, watchlist, portfolio, orders, alerts, settings, auth pages), the layout, SEO files.
- `src/features/<area>/`: one `use-*-page.ts` view-model per screen, plus `.tsx` files that only render.
- `src/components/`: layout and trading pieces shared across features, such as the memoized `StockRow`.
- `src/lib/client.ts`: builds the `@sarwa/core` client with cookie auth (`webCookieAuth`) and polling, then WebSocket transports.
- `src/lib/server-api.ts`: server-side snapshot fetches, cached for 5 s (`SNAPSHOT_REVALIDATE_SECONDS`). The socket replaces those prices on its first tick.
- `src/proxy.ts`: a nonce-based CSP for each request. `src/providers/`: app providers.
- `test/`: Jest tests, which mirror `src/`.

## Boundaries

The app may use `@sarwa/core`, `@sarwa/ui`, `@sarwa/contracts` and `@sarwa/tokens`. It never imports `@sarwa/core/admin`. Files under `src/features/**/*.tsx` and `src/components/**/*.tsx`, and the `use-*.ts` view-models, never import React Query or `useSarwa` directly. No hex colours or font-file names in components.

See the [root README](../../README.md), [architecture](../../docs/architecture.md), and ADRs [0002](../../docs/adr/0002-expo-mobile-nextjs-web-and-admin.md), [0003](../../docs/adr/0003-share-logic-not-ui.md), [0006](../../docs/adr/0006-realtime-socketio-snapshot-stream.md), [0008](../../docs/adr/0008-customer-accounts-and-sessions.md), [0010](../../docs/adr/0010-arabic-and-rtl-first-class.md) and [0013](../../docs/adr/0013-security-headers-csp-client-ip-rate-limits.md).
