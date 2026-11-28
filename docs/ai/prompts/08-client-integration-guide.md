# Client integration guide (from the core-session branch, merged as 9de351d)

## Wiring

- `createSarwaClient({ apiUrl, storage, identityStorage?, randomUUID, transports?, authTransport?, intentStorage?, analytics? })`.
  - **Web:** `authTransport: webCookieAuth({ readCookie: (name) => cookieValue(name) })`. `intentStorage` is a `KeyValueStorage` backed by sessionStorage.
    - Cookies are sent with `credentials: 'include'`.
    - Mutations carry `x-csrf-token`, read from the `sarwa_csrf` cookie.
    - Every request carries `x-client-platform: web`.
  - **Mobile:** `authTransport: bearerAuth({ storage: TokenStorage, platform: 'ios' | 'android' })`.
    - `TokenStorage` is a `KeyValueStorage` plus `removeItem`, backed by SecureStore.
    - Keys: `sarwa.accessToken` and `sarwa.refreshToken`.
    - The refresh token goes in the request body. The socket handshake carries `token`.
- Mount `useAuthSync({ onIdentityChange?: (userId: string | null) => void })` once, next to `useTradingEvents`.
  - At launch it restores the session through `me`. Mobile skips this call when it has no refresh token.
  - On an identity change it cancels queries, removes `['me']` and reconnects the socket.
  - On `session.revoked` it ends the session with the reason, or marks it `suspended` with the details.
  - Mobile uses `onIdentityChange` to switch the persister key (`createPersistOptions(userId ?? 'guest')`) and to register or delete the push token.
- Mount `useResumeIntent(): AuthIntent | null` once. It returns the guest's pending intent one time, after sign-in.
  - `watch` is applied automatically: show the "Saved to Watchlist" toast.
  - `order {symbol, side, form?}` reopens the ticket with `useOrderTicket({ symbol, initialSide, initialForm: intent.form })`. Never auto-submit.
  - `alert {symbol?, condition?, target?}` reopens the alert form.
  - `portfolio`, `orders` and `notifications` navigate to that tab.

## Session and gate

- `useSession()` returns `{ status: 'loading'|'guest'|'authenticated'|'suspended', user, suspension, revokedReason, isAuthenticated, isGuest, acknowledge() }`.
  - When `revokedReason` is set, show the "You were signed out" sheet using `t.revoked.reasons[revokedReason]`, or `t.revoked.reasonsDetailed` when there is device or time info.
  - When `status === 'suspended'`, go to `/suspended`.
  - `acknowledge()` dismisses the sheet and continues as a guest.
- `useRequireAuth()` returns `{ allowed, run(intent, action) }`.
- `useGate()` returns `{ isOpen, intent, open, close }`.
  - Web renders a Dialog; mobile renders `AuthGateSheet`.
  - The title comes from `t.gate.title[intent.kind]`.
  - It closes after a successful sign-in or sign-up.
- These hooks are already gated for guests: `useToggleWatchlist`/`useWatchToggle`, `usePlaceOrder().submit`, `useCreateAlert().create`, `useAlertForm().submit`, `useMarkNotificationRead`, `useMarkAllRead`.
  - Personal queries don't run for guests, and their `isLoading` is false.
- `usePrivateScope()` returns `{ keys: MeKeys, enabled }`.

## Auth forms

Every form hook returns `{ submit(input), isPending, isSuccess, data, error: AuthErrorCode|null, fieldErrors, retryIn: 'm:ss'|null, retryReady, canSubmit, reset }`.

- Show `error` through `t.auth.errors[code]`. `RATE_LIMITED` takes `{time: retryIn}`.
- Show field errors through `t.auth.fieldErrors[code]`.

The hooks:

- `useSignUp()`: `data.claimed` triggers the claimed toast.
- `useSignIn()`: adds `needsDiscard`, `counts {positions, openOrders, watchlist}`, `confirm()` and `cancel()`.
  - `ACCOUNT_SUSPENDED` moves the session to suspended.
  - `data.deletionCanceled` triggers a toast.
- `useSignOut()` returns `{ signOut, isPending }`.
- `useForgotPassword()`: adds `sentTo`, `resendIn` and `resend()` (60 s cooldown).
- `useResetPassword(token)`: adds `link: 'checking'|'ready'|'expired'|'failed'`, `email` and `sessionsRevoked`. Submit with `{password, confirm, keepSignedIn?}`.
- `useVerifyEmail(token)` returns `{ state, email }`.
- `useResendVerification()` returns `{ resend(email?), sent, resendIn, canResend, error, isPending }`.
- `useChangePassword()`: submit `{current, next, confirm}`, then read `sessionsRevoked`.
- `useUpdateProfile()`: submit `{name}`.
- `useSessions()` returns `{ current, others, isLoading, isError, retry }`. Pair it with `useRevokeSession()` and `useSignOutOthers()`.
- `useMeSummary()` has no positions count; take that from `usePortfolio`.
- `useDeleteAccount()`: submit `{password, confirm:'DELETE'}`, then read `purgeAt`.
- `useSelfReset()`: submit `{confirm:'RESET'}`.
- Also exported: `useCooldown()` and `clockText(seconds)`.

## Home and notifications

- `useHomeView()` returns `{ mode: 'guest'|'member', isLoading, movers {tab,setTab,rows,isLoading}, heatmap, guest {badge,title,body,bodyMobile,howItWorks,steps[],createAccount,signIn}|null, checklist {title, items[{key,label,done,action}]}|null }`.
- Notification rows: `notificationRows(items, now, copy, user ?? undefined)`. The `welcome` kind uses the reader's name.

## Rules re-exported from core (apps never import @sarwa/domain)

`@sarwa/core` and `@sarwa/core/pure` export `passwordStrength`, `checkPassword`, `needsNumberOrSymbol`, `PasswordStrength`, `PasswordIssue`, `AuthFieldError`, `PASSWORD_POLICY`, `NAME_MAX_LENGTH`, `ADMIN_REASON_LENGTH`, `SUSPENSION_CATEGORIES`, `DELETE_CONFIRM` and `RESET_CONFIRM`. Error states can show `ApiError.requestId`.

## Admin (@sarwa/core/admin)

- **List and filters:**
  - `customerFiltersFromParams(get)` and `customerFiltersToParams(filters)` (a null value removes the key).
  - `customersQuery(filters)`.
  - `useCustomers(query)` is an infinite query that returns `items` and `total` and keeps `hasNextPage`/`fetchNextPage`.
- **Overview and export:** `useCustomerKpis()`, and `useExportCustomers({ save: downloadCsv })` with `mutate(query)`.
- **Customer detail:**
  - `useCustomer(handle)`. A missing customer shows as `isApiError(error, ErrorCode.NotFound)`.
  - Tabs: `useCustomerOrders(handle)` (infinite, with `notionalCents`), `useCustomerSessions(handle)` and `useCustomerActivity(handle)` (infinite).
  - `useRevealCustomer(handle)` returns `{ reveal, ips: Map<sessionId, ip> }`.
  - `customerPositionRow(position)` adds `avgCostTicks`, `returnCents` and `returnBps`.
- **Mutations** take `{handle, body}`: `useSuspendCustomer`, `useReactivateCustomer`, `useSignOutCustomer`, `useSendCustomerReset` and `useResetCustomerAccount`. Each one invalidates `['admin','customers']`.
- **Team:** `useInvites`, `useCreateInvite` and `useRevokeInvite`.
- **Invite accept page:** `useInviteInfo(token)` is public and never redirects to admin sign-in. `useAcceptInvite({ onSuccess })` sets `adminKeys.session`.

## Compatibility

- `SarwaClient.auth` is optional. Without `authTransport`, the device is the identity, so the existing fixtures still work.
- The legacy `queryKeys.*` are kept only for mobile's persister and tests. Remove them once the apps use `meKeys`.
- On web, a guest's launch makes two calls: `me` returns 401, then refresh returns 401, and the session settles as guest.
