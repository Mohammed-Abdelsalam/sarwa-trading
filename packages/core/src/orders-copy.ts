import { type Order } from '@sarwa/contracts';
import {
  absolute,
  cents,
  changeBps,
  isTerminal,
  micros,
  orderRealizedCents,
  remainingAmountCents,
  remainingQtyMicros,
  ticks,
} from '@sarwa/domain';

import { direction, type Direction } from './format';
import { type I18n } from './hooks/i18n';
import { orderFill } from './trading';

type Copy = Pick<I18n, 't' | 'f' | 'rejection'>;

export interface OrderTimelineStep {
  key: string;
  title: string;
  detail: string;
  state: 'done' | 'now' | 'failed';
}

export interface OrderAmountRow {
  label: string;
  value: string;
  direction: Direction | null;
}

export function isCancellable(order: Pick<Order, 'status'>): boolean {
  return !isTerminal(order.status);
}

export function orderPriceTicks(order: Pick<Order, 'limitTicks' | 'stopTicks'>): number | null {
  return order.limitTicks ?? order.stopTicks;
}

export function orderTitle(order: Order, { t }: Pick<Copy, 't'>): string {
  const side = order.side === 'buy' ? t.ticket.buyTitle : t.ticket.sellTitle;
  return `${side({ symbol: order.symbol })} · ${t.ticket.types[order.type]}`;
}

export function orderTypeLabel(order: Order, { t, f }: Copy): string {
  const price = orderPriceTicks(order);
  const type = `${t.ticket.types[order.type]}${price === null ? '' : ` ${f.price(ticks(price))}`}`;
  return order.type === 'market' ? type : `${type} · ${t.ticket.tif[order.tif]}`;
}

export function orderSizeLabel(order: Order, { t, f }: Copy): string {
  if (order.amountCents !== null) return f.money(cents(order.amountCents));
  return t.common.sharesShort({ shares: f.shares(micros(order.qtyMicros ?? order.heldMicros)) });
}

function canceledText(order: Order, { t }: Pick<Copy, 't'>): string {
  return order.cancelReason ? t.orders.canceledBy[order.cancelReason] : t.orderStatus.canceled;
}

function workingText(order: Order, { t, f }: Copy): string {
  const amount = remainingAmountCents(order);
  if (order.qtyMicros === null && amount !== null) {
    return t.orders.workingAmount({ amount: f.money(amount) });
  }
  return t.orders.working({ shares: f.shares(remainingQtyMicros(order) ?? micros(0)) });
}

// One line on what the order is doing; `lastTicks` adds how far a resting limit is from the market.
export function orderNote(order: Order, copy: Copy, lastTicks: number | null = null): string {
  const { t, f } = copy;
  const avg = orderFill(order).avgFillTicks;
  const price = orderPriceTicks(order);
  switch (order.status) {
    case 'filled':
      return avg === null ? t.orderStatus.filled : t.orders.filledAtPrice({ price: f.price(avg) });
    case 'partially_filled':
      return t.orders.filledOf({
        filled: f.shares(micros(order.filledMicros)),
        total: f.shares(micros(order.qtyMicros ?? order.filledMicros + order.heldMicros)),
      });
    case 'rejected':
      return order.rejection ? copy.rejection(order.rejection, order.symbol).reason : '';
    case 'canceled':
      return canceledText(order, copy);
    case 'expired':
      return t.orders.expiredAtClose;
    case 'queued':
      return t.orderStatus.queued;
    case 'open':
      if (order.type === 'stop' && price !== null) {
        const trigger = order.side === 'buy' ? t.orders.triggersAbove : t.orders.triggersBelow;
        return trigger({ price: f.price(ticks(price)) });
      }
      if (price !== null && lastTicks !== null) {
        return t.orders.lastAway({
          price: f.price(ticks(lastTicks)),
          pct: f.percent(absolute(changeBps(lastTicks, price))),
        });
      }
      return workingText(order, copy);
  }
}

export function orderTime(ms: number, now: number, { f }: Pick<Copy, 'f'>): string {
  return new Date(ms).toDateString() === new Date(now).toDateString() ? f.time(ms) : f.dateTime(ms);
}

function reservedText(order: Order, { t, f }: Copy): string | null {
  if (order.side === 'buy') {
    return order.heldCents > 0
      ? t.orders.reservedCash({ amount: f.money(cents(order.heldCents)) })
      : null;
  }
  return order.heldMicros > 0
    ? t.orders.reserved({ shares: f.shares(micros(order.heldMicros)) })
    : null;
}

function finalStep(order: Order, copy: Copy): OrderTimelineStep | null {
  const { t, f } = copy;
  const at = order.closedAt ?? order.updatedAt;
  switch (order.status) {
    case 'open':
    case 'partially_filled': {
      const expires = order.expiresAt;
      return {
        key: 'working',
        title: workingText(order, copy),
        detail:
          expires === null
            ? ''
            : order.tif === 'day'
              ? t.orders.expiresAtClose({ time: f.time(expires) })
              : f.dateTime(expires),
        state: 'now',
      };
    }
    case 'queued':
      return {
        key: 'queued',
        title: t.orderStatus.queued,
        detail: f.dateTime(order.createdAt),
        state: 'now',
      };
    case 'canceled':
      return {
        key: 'canceled',
        title: canceledText(order, copy),
        detail: f.time(at, { seconds: true }),
        state: 'failed',
      };
    case 'expired':
      return {
        key: 'expired',
        title: t.orders.expiredAtClose,
        detail: f.time(at),
        state: 'failed',
      };
    case 'rejected':
      return {
        key: 'rejected',
        title: t.orderStatus.rejected,
        detail: order.rejection ? copy.rejection(order.rejection, order.symbol).explanation : '',
        state: 'failed',
      };
    case 'filled':
      return null;
  }
}

export function orderTimeline(order: Order, copy: Copy): OrderTimelineStep[] {
  const { t, f } = copy;
  const time = (ms: number) => f.time(ms, { seconds: true });
  const steps: OrderTimelineStep[] = [
    {
      key: 'placed',
      title: t.orders.placed,
      detail: `${time(order.createdAt)} · ${order.id}`,
      state: 'done',
    },
  ];
  if (order.status !== 'rejected') {
    const held = reservedText(order, copy);
    steps.push({
      key: 'accepted',
      title: t.orders.accepted,
      detail: held ? `${time(order.createdAt)} · ${held}` : time(order.createdAt),
      state: 'done',
    });
  }
  order.fills.forEach((fill, i) => {
    const last = order.status === 'filled' && i === order.fills.length - 1;
    const params = {
      shares: f.shares(micros(fill.qtyMicros)),
      price: f.price(ticks(fill.priceTicks)),
    };
    steps.push({
      key: fill.id,
      title: last ? t.orders.filledLine(params) : t.orders.partiallyFilled(params),
      detail: time(fill.at),
      state: 'done',
    });
  });
  const final = finalStep(order, copy);
  return final ? [...steps, final] : steps;
}

// How much of the order has filled, by shares or by dollars; a rejected order never started.
export function fillProgress(order: Order, { t, f }: Copy) {
  const byShares = order.qtyMicros !== null;
  const done = byShares ? order.filledMicros : order.filledNotionalCents;
  const total = (byShares ? order.qtyMicros : order.amountCents) ?? 0;
  if (order.status === 'rejected' || total <= 0) return null;
  const show = (value: number) => (byShares ? f.shares(micros(value)) : f.money(cents(value)));
  const params = { filled: show(done), total: show(total) };
  const avg = orderFill(order).avgFillTicks;
  return {
    value: done / total,
    ...params,
    text: t.orders.filledOf(params),
    a11y: t.orders.filledOfA11y(params),
    avg: avg === null ? null : t.orders.avg({ price: f.price(avg) }),
  };
}

export function orderSoFar(order: Order, { t, f }: Copy): OrderAmountRow {
  return {
    label: order.side === 'sell' ? t.orders.proceedsSoFar : t.orders.costSoFar,
    value: f.money(cents(order.filledNotionalCents)),
    direction: null,
  };
}

// Only a sell realizes P&L, and only once something has filled.
export function orderRealized(
  order: Order,
  { t, f }: Copy,
): (OrderAmountRow & { direction: Direction }) | null {
  if (order.side !== 'sell' || order.fills.length === 0) return null;
  const realized = orderRealizedCents(order);
  return {
    label: t.orders.realizedPl,
    value: f.money(realized, { signed: true }),
    direction: direction(realized),
  };
}

export function cancelLabel(order: Pick<Order, 'filledMicros'>, { t }: Pick<Copy, 't'>): string {
  return order.filledMicros > 0 ? t.orders.cancelRemaining : t.orders.cancelOrder;
}
