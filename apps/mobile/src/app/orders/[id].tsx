import { useLocalSearchParams } from 'expo-router';

import { GuestFeatureScreen, MemberOnly } from '../../features/gating/guest-views';
import { OrderDetailScreen } from '../../features/orders/order-detail-screen';

export default function OrderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <MemberOnly guest={<GuestFeatureScreen kind="orders" />}>
      <OrderDetailScreen id={id} />
    </MemberOnly>
  );
}
