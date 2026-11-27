import { useLocalSearchParams } from 'expo-router';

import { OrderDetailScreen } from '../../features/orders/order-detail-screen';

export default function OrderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderDetailScreen id={id} />;
}
