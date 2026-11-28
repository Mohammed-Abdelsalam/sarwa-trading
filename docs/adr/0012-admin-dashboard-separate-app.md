# ADR 0012: Admin dashboard as a separate app, with roles, PII masking and an audit log

## Status

Accepted

## Context

Operators need to watch the market and trading engine, halt symbols, flip the kill switch, manage stocks and app config, and look after customers (suspend, sign out, reset). Some staff should see everything but change nothing. Customer emails and IP addresses are personal data. Every sensitive action must be traceable. None of this belongs in the customer website's bundle, routes or security model.

## Decision

- **A separate Next.js 16 app, `apps/admin`**, on its own port, with its own routes: overview, market, trading, orders, customers, stocks, config, audit log and team. It reuses `@sarwa/ui` (with web) and `@sarwa/core/admin` (hooks only the dashboard may import; customer apps are blocked by lint).
- **Its own auth:** admin users (separate from customers) sign in with an httpOnly `SameSite=Strict` cookie. The JWT has `aud: 'admin'` and a `ver` claim that holds the admin's `tokenVersion`, so logout or disabling an admin revokes it at once. New admins join through a single-use, 48-hour email invite; there is no "create user with password".
- **Same-origin through Next rewrites** (`/api/*`, `/socket.io/`), like the web app. Writes to `/api/v1/admin/*` must not be cross-site (`SameOriginGuard`). The `proxy.ts` redirect to `/login` is an optimistic check only; the API verifies every request.
- **Two roles, ADMIN and VIEWER.** `AdminGuard` reads `@Roles(['ADMIN'])` on each write handler; a VIEWER gets 403. VIEWER can still open every page, including Customers and Audit.
- **PII masking on the server.** `common/pii.ts` decides by role (`piiViewOf`): ADMIN sees full emails, VIEWER sees `s•••@example.com`. IP addresses are masked for every role (`41.32.•.•`). Audit payloads are masked deeply (`maskDeep`), at any nesting level. The browser never receives raw values it may not show.
- **Audited reveal:** an ADMIN can reveal a customer's full session IPs with an explicit action (`POST .../reveal`), logged as `customer.pii_viewed`. CSV export of customers is ADMIN-only and logged as `customer.export`.
- **Audit log** of every admin and customer security action: actor, action, entity, a payload (customer actions record before and after values) and the source IP. A retention job runs hourly: the IP is cleared after 90 days (`AUDIT_PII_RETENTION_DAYS`), events are deleted after 400 days (`AUDIT_RETENTION_DAYS`), and ended sessions are pruned after 30 days.
- **Not indexed:** `X-Robots-Tag: noindex, nofollow` on every response, plus a `robots.ts` that disallows all.

## Why

- A separate app keeps admin code, routes and dependencies out of the customer bundle, and gives the dashboard a stricter cookie and its own deploy.
- Masking on the server is the only way to be sure the UI cannot leak data, whatever the client does.
- A VIEWER role lets support and analysts work without write risk; the audited reveal covers the rare case that needs full data.
- Retention windows follow data minimization: keep the trail long enough for audits, drop personal details sooner.

## Alternatives considered

- **Admin routes inside the web app:** one deploy, but admin code and risk sit next to the public site, and the cookie and CSP rules would have to serve both.
- **A generic admin tool (Retool, AdminJS):** fast, but no live market view, and masking would live outside our code.
- **Masking in the UI only:** rejected; the raw data would still reach the browser.

## Consequences

- Good: clear separation of customer and staff surfaces; least privilege by default; every sensitive action is traceable.
- Good: the dashboard reuses core hooks and ui components, so it costs mostly view code.
- Bad: a third frontend to build, test (admin has its own coverage floor) and deploy.
- Bad: role checks are per handler; a new write route without `@Roles(['ADMIN'])` would be open to VIEWER, so tests must cover every gated route.
- Bad: retention runs in process on a timer, so it depends on the single server instance staying up.
