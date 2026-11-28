# ADR 0002: Expo for mobile, dedicated Next.js apps for web and admin

## Status

Accepted

## Context

The product needs a mobile app, a customer website and an internal admin dashboard. Expo (React Native) targets iOS and Android, and Expo for Web (React Native Web) could render the same React Native screens in a browser. That would mean one UI codebase for every customer platform.

The developer is a frontend web engineer first. On the web, the things that make a product feel finished are rendering on the server, search, security headers, accessibility and responsive layout. These are exactly the areas where a React Native Web build is weakest.

## Decision

- **Mobile:** Expo (SDK 58) with Expo Router, NativeWind and only libraries that run in Expo Go (no custom native modules, no dev client required).
- **Web:** a dedicated Next.js 16 App Router app (`apps/web`).
- **Admin:** a second, separate Next.js 16 app (`apps/admin`), see ADR 0012.
- The business logic is written once in `@sarwa/core` and used by all three clients (ADR 0003). Only the view layer exists twice.

## Why

Next.js gives the web build strengths that React Native Web does not:

- **Server rendering with a snapshot, then a live stream.** The root layout prefetches the stock list and trading status on the server and hydrates them into React Query, so the first paint has real prices. Market data is fetched with a 5-second revalidation (`SNAPSHOT_REVALIDATE_SECONDS`); trading status is always `no-store`. The socket then takes over (ADR 0006).
- **SEO:** `generateMetadata` with Open Graph and Twitter cards, `robots.ts`, `sitemap.ts`, Open Graph images, and JSON-LD on the root layout and the stock pages.
- **App Router:** layouts, `loading`, `error`, `global-error` and `not-found` per route, and React Server Components for the static parts of a page.
- **Security:** a per-request nonce Content-Security-Policy set in `proxy.ts`, plus HSTS, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy and Permissions-Policy (ADR 0013).
- **Same-origin API through rewrites:** `/api/*` and `/socket.io/` are proxied by Next, so the httpOnly session cookies stay first-party with `SameSite=Lax` (`Strict` for the admin session) and no CORS (ADR 0008).
- **Accessibility and responsive layout** with semantic HTML and CSS breakpoints instead of JavaScript-chosen layouts. Server-rendered `lang` and `dir` come from a cookie (ADR 0010).
- **Quality bar:** accessibility, SEO and best practices are checked by hand with Lighthouse on the production build, targeting 100; the recorded scores are on the [Lighthouse page](../performance/lighthouse/README.md).

Expo for mobile:

- One TypeScript and React codebase for iOS and Android.
- **Expo Go** lets a reviewer scan a QR code and run the app on a real phone without building anything.
- Native feel where it matters: SecureStore for tokens, haptics, Reanimated, FlashList.

## Alternatives considered

- **Expo for Web (React Native Web) for the customer site.** One UI for all clients, but a client-rendered single-page app: no server-side first paint with data, weaker SEO, a DOM built from `View`s instead of semantic elements, and less control over headers and CSP. Rejected on purpose.
- **Next.js plus a WebView or Capacitor shell for mobile.** Rejected: it does not feel native, and gestures, lists and secure storage are worse.
- **Bare React Native.** More control, but no Expo Go, so reviewers would need a native build.

## Consequences

- Good: each platform uses its own strengths; the web is a real website, the mobile app is a real native app.
- Good: logic, validation, copy and tokens are shared, so the cost of two UIs is the view layer only (screens and components).
- Bad: every screen exists twice (web and mobile). New features need two views, and visual parity has to be checked on both.
- Bad: the web and mobile component sets are different (`@sarwa/ui` vs the mobile `components/`), so a design change is applied twice.
- Bad: Expo Go limits the native libraries that can be used; anything outside it would need a development build.
