import { type Order } from '@sarwa/contracts';
import { orderNote, orderSizeLabel, orderTime, orderTypeLabel } from '@sarwa/core';

import { type Copy } from '../../lib/i18n';

export interface OrderLine {
  id: string;
  symbol: string;
  side: Order['side'];
  status: Order['status'];
  typeLine: string;
  amount: string;
  note: string;
  time: string;
  a11yLabel: string;
}

export function describeOrder(order: Order, copy: Copy, now: number): OrderLine {
  const { t } = copy;
  const line = {
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    status: order.status,
    typeLine: orderTypeLabel(order, copy),
    amount: orderSizeLabel(order, copy),
    note: orderNote(order, copy),
    time: orderTime(order.createdAt, now, copy),
  };
  return {
    ...line,
    a11yLabel: [
      order.side === 'buy' ? t.common.buy : t.common.sell,
      line.symbol,
      line.amount,
      line.typeLine,
      t.orderStatus[order.status],
      line.note,
      line.time,
    ]
      .filter(Boolean)
      .join(', '),
  };
}
