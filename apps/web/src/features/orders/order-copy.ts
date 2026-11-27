import { type Order } from '@sarwa/contracts';
import { absolute, cents, changeBps, micros, ticks } from '@sarwa/core';

import { type Copy } from '../../lib/i18n';

export const CANCELLABLE: readonly Order['status'][] = ['queued', 'open', 'partially_filled'];

export function orderPriceTicks(order: Order): number | null {
  return order.limitTicks ?? order.stopTicks;
}

export function orderTypeLabel(order: Order, { t, f }: Copy): string {
  const price = orderPriceTicks(order);
  const type = `${t.ticket.types[order.type]}${price === null ? '' : ` ${f.price(ticks(price))}`}`;
  return order.type === 'market' ? type : `${type} · ${t.ticket.tif[order.tif]}`;
}

export function orderSizeLabel(order: Order, { t, f }: Copy): string {
  if (order.amountCents !== null) return f.money(cents(order.amountCents));
  if (order.qtyMicros !== null)
    return t.common.sharesShort({ shares: f.shares(micros(order.qtyMicros)) });
  return '—';
}

// Shares still working; amount orders have no fixed share count until they fill.
export function remainingMicros(order: Order): number | null {
  return order.qtyMicros === null ? null : Math.max(0, order.qtyMicros - order.filledMicros);
}

export function orderDetail(order: Order, lastTicks: number | null, copy: Copy): string {
  const { t, f } = copy;
  const avg = order.avgFillTicks;
  const price = orderPriceTicks(order);
  switch (order.status) {
    case 'filled':
      return avg === null
        ? t.orderStatus.filled
        : t.orders.filledAtPrice({ price: f.price(ticks(avg)) });
    case 'partially_filled':
      return t.orders.partiallyFilled({
        shares: f.shares(micros(order.filledMicros)),
        price: avg === null ? '—' : f.price(ticks(avg)),
      });
    case 'rejected':
      return order.rejection ? copy.rejection(order.rejection, order.symbol).reason : '';
    case 'canceled':
      return order.cancelReason === 'user' ? t.orders.canceledByYou : t.orderStatus.canceled;
    case 'expired':
      return t.orders.expiredAtClose;
    case 'queued':
      return t.orderStatus.queued;
    case 'open':
      if (order.type === 'stop' && price !== null) {
        return (order.side === 'buy' ? t.orders.triggersAbove : t.orders.triggersBelow)({
          price: f.price(ticks(price)),
        });
      }
      if (price !== null && lastTicks !== null) {
        return t.orders.lastAway({
          price: f.price(ticks(lastTicks)),
          pct: f.percent(absolute(changeBps(lastTicks, price))),
        });
      }
      return t.orderStatus.open;
  }
}

export function orderTime(ms: number, now: number, { f }: Copy): string {
  return new Date(ms).toDateString() === new Date(now).toDateString() ? f.time(ms) : f.dateTime(ms);
}
