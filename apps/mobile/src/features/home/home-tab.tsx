import { MemberOnly } from '../gating/guest-views';
import { GuestHomeScreen } from './guest-home';
import { HomeScreen } from './home-screen';
import { useGuestHomeScreen } from './use-guest-home-screen';

function GuestHome() {
  return <GuestHomeScreen view={useGuestHomeScreen()} />;
}

export function HomeTab() {
  return (
    <MemberOnly guest={<GuestHome />}>
      <HomeScreen />
    </MemberOnly>
  );
}
