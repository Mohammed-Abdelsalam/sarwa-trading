import { type Order } from '@sarwa/contracts';
import { cents, micros, orderFill, ticks } from '@sarwa/core';

import { type Copy } from '../../lib/i18n';

const DAY_MS = 24 * 60 * 60 * 1000;

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

export function isWorking(order: Pick<Order, 'status'>): boolean {
  return (
    order.status === 'open' || order.status === 'partially_filled' || order.status === 'queued'
  );
}

export function orderTypeLine(order: Order, { t, f }: Copy): string {
  const price = order.type === 'limit' ? order.limitTicks : order.stopTicks;
  if (order.type === 'market' || price === null) return t.ticket.types[order.type];
  return `${t.ticket.types[order.type]} ${f.price(ticks(price))} · ${t.ticket.tif[order.tif]}`;
}

export function orderAmount(order: Order, { t, f }: Copy): string {
  if (order.amountCents !== null) return f.money(cents(order.amountCents));
  return t.common.sharesShort({ shares: f.shares(micros(order.qtyMicros ?? order.heldMicros)) });
}

function orderNote(order: Order, copy: Copy): string {
  const { t, f, rejection } = copy;
  const avg = orderFill(order).avgFillTicks;
  switch (order.status) {
    case 'filled':
      return avg === null ? '' : t.orders.filledAtPrice({ price: f.price(avg) });
    case 'partially_filled':
      return t.orders.filledOf({
        filled: f.shares(micros(order.filledMicros)),
        total: f.shares(micros(order.qtyMicros ?? order.filledMicros + order.heldMicros)),
      });
    case 'rejected':
      return order.rejection ? rejection(order.rejection, order.symbol).reason : '';
    case 'canceled':
      return t.orders.canceledByYou;
    case 'expired':
      return t.orders.expiredAtClose;
    case 'queued':
      return t.orderStatus.queued;
    case 'open':
      if (order.type === 'stop' && order.stopTicks !== null) {
        const price = f.price(ticks(order.stopTicks));
        return order.side === 'buy'
          ? t.orders.triggersAbove({ price })
          : t.orders.triggersBelow({ price });
      }
      return t.orders.working({ shares: f.shares(micros(order.heldMicros)) });
  }
}

export function orderTime(ms: number, now: number, { f }: Copy): string {
  return now - ms < DAY_MS ? f.time(ms) : f.relative(ms, now);
}

export function describeOrder(order: Order, copy: Copy, now: number): OrderLine {
  const { t } = copy;
  const side = order.side === 'buy' ? t.common.buy : t.common.sell;
  const line = {
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    status: order.status,
    typeLine: orderTypeLine(order, copy),
    amount: orderAmount(order, copy),
    note: orderNote(order, copy),
    time: orderTime(order.createdAt, now, copy),
  };
  return {
    ...line,
    a11yLabel: [
      side,
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
