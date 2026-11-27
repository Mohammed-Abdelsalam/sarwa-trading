import { GuestFeatureScreen, MemberOnly } from '../features/gating/guest-views';
import { NotificationsScreen } from '../features/notifications/notifications-screen';

export default function NotificationsRoute() {
  return (
    <MemberOnly guest={<GuestFeatureScreen kind="notifications" />}>
      <NotificationsScreen />
    </MemberOnly>
  );
}
