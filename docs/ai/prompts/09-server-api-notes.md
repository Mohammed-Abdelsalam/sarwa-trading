# Server API notes for the clients (feat/accounts-server, merged as 910ea29)

## Auth modes

- If a request has `Authorization: Bearer …`, the server uses bearer auth. Otherwise it reads the `sarwa_access` cookie.
- When the server issues tokens:
  - `x-client-platform: ios|android`: tokens come back in the response body.
  - Anything else (web): tokens are set as cookies. The web must always send `x-client-platform: web`.

## Web (cookies)

- `sarwa_access`: httpOnly, Lax, path `/`, 15 minutes.
- `sarwa_refresh`: httpOnly, path `/api/v1/auth`.
- `sarwa_csrf`: readable by JS, path `/`.
- Every cookie mutation sends `x-csrf-token` equal to the `sarwa_csrf` cookie, from the same origin. This includes refresh and sign-out.
- A failed CSRF check returns 403 `CSRF_FAILED`.

## Mobile (bearer)

- Requests send `Authorization: Bearer <access>`.
- Refresh: `POST /auth/refresh {refreshToken}` returns the new tokens in the body.
- `POST /auth/sign-out` takes either the bearer token or `{refreshToken}`.
- Send `deviceModel` on sign-up, sign-in and reset. It becomes the session label.

## Refresh

- The refresh token rotates on every use.
- Reusing an old token within 10 seconds is treated as a tab race and still works.
- Reusing it after 10 seconds revokes the session: 401 `SESSION_REVOKED` plus the socket event `session.revoked`.
- A failed web refresh clears the cookies.
- Every session response includes `accessExpiresAt`.

## Guest identity

- Send `x-device-id` on sign-up and sign-in.
- Sign-up claims the guest's data and returns `claimed: {positions, openOrders, watchlist}`.
- Sign-in on a device whose guest has data returns 409 `GUEST_DATA_PRESENT {ticket, positions, openOrders, watchlist}`.
  - Re-submit with `guestTicket` (valid for 2 minutes) to discard the guest data.

## Personal routes

- Guests get 401 `UNAUTHORIZED`.
- A revoked, suspended or deleted account gets 401 `SESSION_REVOKED`.

## Errors (problem+json `code`)

- Sign-in
  - 401 `INVALID_CREDENTIALS`
  - 403 `ACCOUNT_SUSPENDED` with `suspension {reasonCategory, reason, at, accountHandle}`
- Sign-up
  - 409 `EMAIL_IN_USE`
  - 400 `VALIDATION_FAILED` with field errors, e.g. `errors.password ['PASSWORD_COMMON']` or `errors.terms ['TERMS_REQUIRED']`. There is no `WEAK_PASSWORD` code.
- Rate limits: 429 `RATE_LIMITED` with `retryAfterSeconds` and a `Retry-After` header.

  | Action          | Limit                                                            |
  | --------------- | ---------------------------------------------------------------- |
  | Sign-in         | 5 failures locks the account for 15 minutes, plus a per-IP limit |
  | Sign-up         | 10 per hour per IP                                               |
  | Forgot password | 3 per hour per email                                             |
  | Resend          | once every 60 seconds                                            |

- An expired or used link returns 410 `TOKEN_EXPIRED`, with `email` when it is known.
- Wrong current password: 400 `INVALID_CURRENT_PASSWORD`. A wrong confirm value: 400 `errors.confirm ['CONFIRMATION_MISMATCH']`.

## Responses

| Route                                | Response                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------- |
| forgot, verify/resend                | 202, empty body                                                            |
| reset                                | 200 with the session and `sessionsRevoked`                                 |
| `DELETE auth/sessions/:id`           | 204. 400 for the current session, 404 if not found                         |
| revoke-others                        | `{revoked, labels}`                                                        |
| me/delete                            | 202 `{purgeAt}`. Signing in within 7 days returns `deletionCanceled: true` |
| me/account/reset `{confirm:'RESET'}` | `{account}`                                                                |

## Sockets (/market)

- Handshake `auth: {deviceId, token?}`. The web sends the cookie instead.
- An invalid token connects as a guest that receives public events only.
- Private events go to the account room only.
- `session.revoked {v:1, reason, suspension?}` is sent and then the socket disconnects.
  - Reasons: signed_out, password_changed, suspended, revoked, deleted.

## Admin

- Customers are identified by handle `ACC-XXXXXX`.
- Writes are ADMIN-only; a VIEWER gets 403.
- VIEWER sees emails masked. IPs are masked for every role.
- reveal returns `{items:[{sessionId, ip}]}`.
- export.csv is ADMIN-only and uses the same filters as the list.
- reset-account requires `confirm: "RESET ACC-…"`; a mismatch returns 422.
- Invites
  - `POST admin/users` is removed.
  - The routes are `admin/invites`, `admin/invites/token/:token` and `admin/invites/accept`. Accepting returns 201 `{user}` and sets the admin cookie.
- `GET admin/accounts` still exists until the /accounts→/customers redirect ships.
- Audit takes `?group=`, and `market` includes `connections.*`.

## Demo customers (outside production)

`demo1@sarwa.dev` to `demo4@sarwa.dev`, password `practice-1234`.
