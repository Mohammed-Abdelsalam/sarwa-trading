import { Redirect, useLocalSearchParams } from 'expo-router';

import { OrderTicketScreen } from '../../features/order-ticket/order-ticket-screen';
import { parseTicketForm } from '../../features/order-ticket/use-order-ticket-screen';

export default function NewOrderRoute() {
  const { symbol, side, form } = useLocalSearchParams<{
    symbol?: string | string[];
    side?: string;
    form?: string;
  }>();
  if (typeof symbol !== 'string' || symbol === '') return <Redirect href="/markets" />;
  const upper = symbol.toUpperCase();
  const initialSide = side === 'sell' ? 'sell' : 'buy';
  return (
    <OrderTicketScreen
      symbol={upper}
      side={initialSide}
      initialForm={parseTicketForm(upper, initialSide, form)}
    />
  );
}
