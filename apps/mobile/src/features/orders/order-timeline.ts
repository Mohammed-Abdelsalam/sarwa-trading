import { type Order } from '@sarwa/contracts';
import { micros, ticks } from '@sarwa/core';

import { type Copy } from '../../lib/i18n';

export interface TimelineStep {
  key: string;
  title: string;
  detail: string;
  state: 'done' | 'now' | 'failed';
}

function remainingMicros(order: Order): number {
  return order.qtyMicros === null
    ? order.heldMicros
    : Math.max(0, order.qtyMicros - order.filledMicros);
}

function finalStep(order: Order, copy: Copy): TimelineStep | null {
  const { t, f, rejection } = copy;
  const at = order.closedAt ?? order.updatedAt;
  switch (order.status) {
    case 'open':
    case 'partially_filled': {
      const expires = order.expiresAt;
      return {
        key: 'working',
        title: t.orders.working({ shares: f.shares(micros(remainingMicros(order))) }),
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
        title: t.orders.canceledByYou,
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
        detail: order.rejection ? rejection(order.rejection, order.symbol).explanation : '',
        state: 'failed',
      };
    case 'filled':
      return null;
  }
}

export function orderTimeline(order: Order, copy: Copy): TimelineStep[] {
  const { t, f } = copy;
  const time = (ms: number) => f.time(ms, { seconds: true });
  const steps: TimelineStep[] = [
    {
      key: 'placed',
      title: t.orders.placed,
      detail: `${time(order.createdAt)} · ${order.id}`,
      state: 'done',
    },
  ];
  if (order.status !== 'rejected') {
    const reserved =
      order.heldMicros > 0
        ? ` · ${t.orders.reserved({ shares: f.shares(micros(order.heldMicros)) })}`
        : '';
    steps.push({
      key: 'accepted',
      title: t.orders.accepted,
      detail: `${time(order.createdAt)}${reserved}`,
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
