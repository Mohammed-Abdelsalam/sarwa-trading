import { GuestFeatureScreen, MemberOnly } from '../../features/gating/guest-views';
import { OrdersScreen } from '../../features/orders/orders-screen';

export default function OrdersRoute() {
  return (
    <MemberOnly guest={<GuestFeatureScreen kind="orders" />}>
      <OrdersScreen />
    </MemberOnly>
  );
}
