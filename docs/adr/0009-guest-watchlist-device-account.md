# ADR 0009: Guest watchlist through a device account

## Status

Accepted. Supersedes an earlier plan in which the watchlist required an account and a guest's star only opened the sign-in gate.

## Context

The brief asks that users can star favourites. With customer accounts (ADR 0008), the first plan copied the Robinhood model: no stars without an account. That made a feature the brief asks for depend on signing up. At the same time, a guest's stars should not be lost when they do sign up, and anonymous devices must not inflate customer numbers in the admin dashboard.

## Decision

- A guest's stars are stored on a **device account**: an `Account` row with `deviceId` set and `userId` null, created on the first star. The client sends its device id in the `x-device-id` header.
- `WatchlistController` is `@OptionalCustomer()`: a signed-in customer stars into their own account; a guest stars into the device account. A guest is capped at 50 stars, because a device account costs nothing to create. A stale access token still returns 401, so the client refreshes instead of silently falling back to the device.
- **Sign-up** re-parents the device account to the new user (`userId` set, `deviceId` cleared) inside the same queued transaction, so the stars move with it. The response reports what was claimed.
- **Sign-in** on a device whose guest account holds only stars merges them into the user's watchlist (skipping duplicates) and deletes the device account, in one queued transaction. Guest portfolios are never merged: if the device account has positions or open orders, sign-in returns 409 `GUEST_DATA_PRESENT` with a 2-minute ticket, and resubmitting with it discards the guest data.
- **Admin counts exclude device accounts:** watchlist totals and "top watchlisted" count only stars on accounts with a user (`userId` not null). Halt notices about a starred symbol also go only to customers.

## Why

- Starring is the brief's own feature, so it works without an account.
- Reusing the existing device account model needed no new tables and fits the claim flow that already existed for paper trading.
- Moving or merging stars means signing up never loses work.
- Excluding device accounts keeps the admin metrics about real customers.

## Alternatives considered

- **Account required to star (the earlier plan):** simpler server, but it blocks a brief feature behind sign-up.
- **Local-only guest stars (localStorage or AsyncStorage) merged at sign-in:** no server rows, but the merge would be written per client, and the server could not see guest stars at all.
- **Merge whole guest portfolios on sign-in:** rejected; mixing two portfolios corrupts history and P&L.

## Consequences

- Good: guests get the full watchlist experience; sign-up and sign-in keep their stars.
- Good: one storage path for stars, whoever owns them.
- Bad: anonymous device accounts accumulate in the database; nothing prunes abandoned ones yet.
- Bad: every admin query about stars must remember the `userId` filter.
- Bad: a cleared device id (reinstall, new browser) loses a guest's stars.
