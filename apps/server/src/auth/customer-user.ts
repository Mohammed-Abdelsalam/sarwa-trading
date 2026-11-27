import { type Account as AccountRow, type User as UserRow } from '@prisma/client';

import { type CustomerUser } from '@sarwa/contracts';

export type UserWithAccount = UserRow & { account: Pick<AccountRow, 'id' | 'handle'> | null };

export function toCustomerUser(user: UserWithAccount): CustomerUser {
  if (!user.account) throw new Error(`User ${user.id} has no account`);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.getTime(),
    passwordChangedAt: user.passwordChangedAt?.getTime() ?? null,
    account: { id: user.account.id, handle: user.account.handle },
  };
}

// The audit entity for anything about one customer, so their activity is one lookup.
export const customerEntity = (handle: string): string => `Customer · ${handle}`;
