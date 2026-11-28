# Example brief: guest watchlist, server

> A real worker brief, rewritten for the repo from the session that ran it. It follows [agent-brief-template.md](agent-brief-template.md). Core, web and mobile agents ran in parallel with this one, each with its own brief; they built against the contract below, not against this agent's code.

---

## Goal

The take-home brief asks for "star favourites" to work. Today a guest's star opens the auth gate. Make the watchlist work for guests without an account, on the server, while keeping signed-in behaviour unchanged.

## Context

- This reverses the earlier "watchlist requires an account" decision (Q2 in [04-master-plan.md](04-master-plan.md), and [07-wave2-decisions.md](07-wave2-decisions.md)). The brief wins.
- A guest is already represented by a device-scoped paper `Account` (`deviceId` set, `userId` null). Reuse it; no new identity model.
- Guest trading stays gated. Only the watchlist opens up.
- Read [09-server-api-notes.md](09-server-api-notes.md) for the current auth modes and the `x-device-id` header.
- Other agents own `packages/core`, `apps/web` and `apps/mobile` right now.

## Workspace

- Your own worktree and branch, based on the current integration branch.
- Setup as in [agent-rules.md](agent-rules.md), including `prisma generate`.

## Files

- **You own:** `apps/server/src/watchlist/**`, `apps/server/src/trading/accounts.service.ts`, `apps/server/src/trading/account-lifecycle.service.ts`, `apps/server/src/auth/**` (only the sign-up/sign-in guest-data path), `apps/server/test/**`.
- **Read-only:** `packages/contracts` (if you need a new error code, report it), `packages/domain`.
- **Forbidden:** every client workspace, `prisma/migrations` unless the schema truly has to change (it shouldn't).

## Work items

1. **Lazy device account.** A guest's first star opens the device account, once, with no user. Reading or unstarring never creates an account; a guest with no account reads an empty list.
2. **Watchlist routes open to guests.** `GET/PUT/DELETE /watchlist` resolve the caller as: a signed-in customer → their own account, whatever device they are on; otherwise the `x-device-id` account. With neither, 401. A request carrying a stale token must get its own 401 so the client refreshes; never fall back silently to the device's list.
3. **Abuse cap.** A guest account costs nothing to make, so cap guest stars (50) with `409 TOO_MANY_SYMBOLS`. Customers have no cap. Watchlist writes stay blocked during maintenance like every other write.
4. **Sign-up and sign-in.** Sign-up keeps the device's guest account as the new user's account, so the stars move with it. Sign-in on a device whose guest account holds only stars merges them into the customer's watchlist without duplicates, in one transaction, then deletes the guest account. Guest trading data is never merged (the existing `GUEST_DATA_PRESENT` flow stays).
5. **Admin numbers stay honest.** A guest device account is never a customer: it must not appear in the customer KPIs, the CSV export or the dashboard counts.

## Tests that must exist (e2e, failing first where they cover new behaviour)

- a device's guest account is opened only when asked for, once, with no user
- the watchlist needs a signed-in customer or a device id
- a stale token gets 401, not the device's list
- a guest's stars stay on their device
- a guest is capped at the limit, a customer is not
- a guest who only reads or unstars opens no account
- a signed-in customer uses their own account, whatever device they are on
- add, list and remove are idempotent
- sign-up moves the stars a guest made on this device into the new account
- sign-in merges a guest's stars into the account without duplicates
- a guest's device account is never a customer, nor counted in the KPIs, the export or the dashboard
- watchlists are read-only during maintenance

## Gate

- `pnpm turbo run typecheck lint test --filter=@sarwa/server...` (server tests run in band)
- `cmd /c "pnpm turbo run test --filter=@sarwa/server -- --coverage --ci"`

## Report

Branch, `git log --oneline`, one line per commit, anything out of scope (for example a contracts change the clients need), and exact gate numbers.
