import { useLocalSearchParams } from 'expo-router';

import { OrderTicketScreen } from '../../features/order-ticket/order-ticket-screen';

export default function NewOrderRoute() {
  const { symbol, side } = useLocalSearchParams<{ symbol: string; side?: string }>();
  return (
    <OrderTicketScreen symbol={symbol.toUpperCase()} side={side === 'sell' ? 'sell' : 'buy'} />
  );
}
