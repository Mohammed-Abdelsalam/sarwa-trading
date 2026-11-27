import { useLocalSearchParams } from 'expo-router';

import { AlertsScreen } from '../features/alerts/alerts-screen';
import { GuestFeatureScreen, MemberOnly } from '../features/gating/guest-views';

export default function AlertsRoute() {
  const { symbol } = useLocalSearchParams<{ symbol?: string }>();
  return (
    <MemberOnly guest={<GuestFeatureScreen kind="alert" />}>
      <AlertsScreen symbol={symbol?.toUpperCase()} />
    </MemberOnly>
  );
}
