# ADR 0003: Share logic, not UI

## Status

Accepted

## Context

Mobile, web and admin show the same data and enforce the same rules: live quotes, order tickets, alerts, notifications, sessions, the sign-in gate. If each app holds its own copy of that logic, the copies drift. An early review found the same order copy and ticket logic written separately in web and mobile, with a real bug in one of them ("Canceled by you" shown for admin resets). The UIs, however, are different by nature (ADR 0002).

## Decision

- **`@sarwa/domain`** holds pure rules: integer money, order validation and estimation, portfolio math, market session hours. No dependencies, 100% coverage.
- **`@sarwa/core`** holds all client logic:
  - the API client (`createSarwaClient`, `createRequest`) and auth transports,
  - the market socket and the live quote store (zustand),
  - React Query hooks and query keys,
  - view data builders (`orders-copy`, `ticket-copy`, `markets`, `notifications`, `alerts`) and screen-level hooks such as `useHomeView`, `useOrderTicket` and `useRequireAuth`.
  - Separate entries: `@sarwa/core` (hooks), `@sarwa/core/pure` (no React), `@sarwa/core/server` (safe for server components) and `@sarwa/core/admin` (dashboard only).
- **Each app screen = one view-model hook plus render-only components.** Web and admin use `use-*-page.ts`, mobile uses `use-*-screen.ts`. The hook calls core and returns view data; components only render.
- **`@sarwa/ui`** is shared by web and admin only: React DOM components (Radix based), theme and browser helpers, and the shared Next settings (`next-config.cjs`). Mobile has its own React Native components.
- **`@sarwa/tokens`** holds the design tokens (colour roles for light and dark, sector colours, scales, component sizes). It ships a Tailwind preset and CSS variables, used by web, admin and mobile (NativeWind).
- **`@sarwa/i18n`** holds every user-facing string in EN and AR.

These rules are enforced by ESLint in every app:

- Files under `src/features/**/*.tsx` and `src/components/**` cannot import `@tanstack/react-query` or `useSarwa`; they get data from a view-model hook or a core hook.
- `use-*.ts` view-models also cannot import React Query or `useSarwa` directly; they go through core hooks.
- Raw hex colours and font-file names are lint errors in components; colours come from tokens.

## Why

- A rule fixed once is fixed for every client. The view data builders are unit tested in core, not three times in the apps.
- Render-only components are easy to test and easy to restyle.
- Sharing UI between React Native and the DOM would force the lowest common denominator (ADR 0002). Sharing logic has no such cost.

## Alternatives considered

- **Shared cross-platform components (React Native Web or Tamagui):** one component set, but it would pull the web toward React Native primitives and away from semantic HTML and CSS layouts.
- **Logic in each app:** fastest at first, but it caused real drift bugs here.
- **Container/presenter split without lint rules:** works only as long as everyone remembers; the lint rules make it mechanical.

## Consequences

- Good: one place for behaviour and copy; apps stay thin; core has an 80/75/80/80 coverage floor (statements, branches, functions, lines).
- Good: adding a screen follows one pattern on every platform.
- Bad: core is large and touches many concerns, so its public surface needs care (the separate `pure`, `server` and `admin` entries keep it in check).
- Bad: view components are still written twice (web/admin in DOM, mobile in React Native), and tokens are the only visual link between them.
- Bad: a view-model hook per screen adds a file even for simple screens.
