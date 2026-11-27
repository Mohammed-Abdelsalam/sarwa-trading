import { Redirect, useLocalSearchParams } from 'expo-router';

import { OrderTicketScreen } from '../../features/order-ticket/order-ticket-screen';

export default function NewOrderRoute() {
  const { symbol, side } = useLocalSearchParams<{ symbol?: string | string[]; side?: string }>();
  if (typeof symbol !== 'string' || symbol === '') return <Redirect href="/markets" />;
  return (
    <OrderTicketScreen symbol={symbol.toUpperCase()} side={side === 'sell' ? 'sell' : 'buy'} />
  );
}
