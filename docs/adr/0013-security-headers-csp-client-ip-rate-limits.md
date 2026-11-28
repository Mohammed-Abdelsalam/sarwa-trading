# ADR 0013: Security headers, nonce CSP, real client IP, and in-memory rate limits

## Status

Accepted

## Context

The web and admin apps render inline scripts (a theme script that prevents a light/dark flash, JSON-LD, Next's own bootstrap). A CSP with `'unsafe-inline'` scripts would not stop injected scripts. The API sits behind the Next rewrites, so it sees the Next server as the client; rate limits and the audit log need the real client IP, and that IP must not be spoofable. The server runs as one process (ADR 0007).

## Decision

**Headers and CSP (web and admin)**

- Shared settings live in `@sarwa/ui/next-config.cjs` and are used by both apps:
  - Static headers: `Strict-Transport-Security` (2 years, subdomains), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that turns off camera, microphone, geolocation and payment. `poweredByHeader` is off.
  - A CSP built **per request** in each app's `proxy.ts` with a fresh nonce: `script-src 'self' 'nonce-...' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `connect-src` limited to the app's own origin (plus the API origin on web), and `upgrade-insecure-requests` on HTTPS. `'unsafe-eval'` is added in development only.
  - The nonce is passed to the root layout through an `x-nonce` request header and stamped on the inline theme script; Next adds it to its own scripts.
- Admin also sends `X-Robots-Tag: noindex, nofollow`.
- The API uses `helmet()` and allows CORS only from `CORS_ORIGINS`, with credentials.

**Real client IP**

- Next's rewrite proxy only fills `X-Forwarded-For` when it is missing, so a client could send a made-up address and the API would trust it.
- Both Next apps register `instrumentation.ts`, which (on the Node runtime only) subscribes to Node's `http.server.request.start` diagnostics channel and **appends** the socket's remote address to `X-Forwarded-For`, as a well-behaved proxy should.
- The API sets Express `trust proxy` from `TRUST_PROXY` (default `loopback`, meaning the local Next servers). It reads the chain from the right, so the last hop is real and spoofed entries to its left are ignored. Behind a load balancer, `TRUST_PROXY` is set to its hops or addresses.

**Rate limits**

- A global `ThrottlerGuard` (120 requests per minute per IP, 30 per minute for placing orders).
- Auth limits (sign-in failures and lockout, sign-up, forgot password, resend) use a small `RateLimiter` with sliding windows **kept in memory**, answering 429 `RATE_LIMITED` with `retryAfterSeconds` and a `Retry-After` header. The global throttler's 429 does not carry `retryAfterSeconds`.

**Other server checks**

- In production the server refuses a weak or example `JWT_SECRET` and the seed refuses to create production admins unless `ADMIN_EMAIL`/`ADMIN_PASSWORD` are set.

## Why

- A nonce with `'strict-dynamic'` blocks injected scripts while allowing the app's own inline scripts, without hashing each one.
- Sharing the header code between web and admin keeps them identical.
- Appending the real address at the first hop is the only way the API can trust the IP it logs and limits by.
- In-memory limits need no extra infrastructure and match the single-instance design.

## Alternatives considered

- **Static CSP with `'unsafe-inline'` scripts:** simpler and cacheable, but weak against XSS.
- **Hash-based CSP:** works for static pages, but breaks with per-request inline content.
- **Trusting `X-Forwarded-For` as given:** rejected; any client could pick its own IP for rate limits and the audit log.
- **Redis-backed throttling:** needed for several instances, unnecessary for one.

## Consequences

- Good: strict script policy, clickjacking and MIME-sniffing protection, and a trustworthy client IP for limits and audits.
- Bad: `style-src` still allows `'unsafe-inline'`, because inline style attributes (chart geometry, Radix positioning) cannot carry a nonce.
- Bad: a per-request nonce makes every page dynamic, so pages cannot be served from a static cache.
- Bad: the IP fix depends on a Node diagnostics channel and the Node runtime; a different hosting runtime would need its own fix.
- Bad: rate-limit and lockout state is lost on restart and is not shared between processes. Running more than one instance needs a shared store (for example Redis) for the throttler and the limiter, together with the Socket.IO adapter and engine split from ADR 0006 and ADR 0007.
