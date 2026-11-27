import { useSession } from '@sarwa/core';

import { GuestAccountScreen } from '../gating/guest-views';
import { AccountScreen } from './account-screen';
import { SignedInAccountScreen } from './signed-in-account';
import { useGuestAccountScreen, useSignedInAccountScreen } from './use-member-account';

function MemberAccount() {
  const view = useSignedInAccountScreen();
  return view ? <SignedInAccountScreen view={view} /> : <AccountScreen />;
}

function GuestAccount() {
  return <GuestAccountScreen view={useGuestAccountScreen()} />;
}

// A member sees their profile; a guest the welcome; the device-only build the paper account.
export function AccountTab() {
  const { isGuest, user } = useSession();
  if (isGuest) return <GuestAccount />;
  return user ? <MemberAccount /> : <AccountScreen />;
}
