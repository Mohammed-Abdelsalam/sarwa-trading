import { useState } from 'react';

import { type ModifyOrderRequest, type Order } from '@sarwa/contracts';
import {
  cents,
  direction,
  micros,
  parseMicros,
  parseTicks,
  ticks,
  useCancelOrder,
  useModifyOrder,
  useOrder,
  useStocks,
} from '@sarwa/core';
import { type TimelineStep } from '@sarwa/ui';

import { type Copy, useCopy } from '../../lib/i18n';
import { CANCELLABLE, orderPriceTicks, orderTypeLabel, remainingMicros } from './order-copy';

export function orderTimeline(order: Order, copy: Copy): TimelineStep[] {
  const { t, f } = copy;
  const steps: TimelineStep[] = [
    {
      id: 'placed',
      title: t.orders.placed,
      meta: f.time(order.createdAt, { seconds: true }),
      state: 'done',
    },
    ...order.fills.map((fill): TimelineStep => ({
      id: fill.id,
      title: t.orders.filledLine({
        shares: f.shares(micros(fill.qtyMicros)),
        price: f.price(ticks(fill.priceTicks)),
      }),
      meta: f.time(fill.at, { seconds: true }),
      state: 'done',
    })),
  ];
  const closedAt = order.closedAt === null ? undefined : f.time(order.closedAt, { seconds: true });
  const remaining = remainingMicros(order);
  if (CANCELLABLE.includes(order.status)) {
    steps.push({
      id: 'working',
      title:
        order.status === 'queued'
          ? t.orderStatus.queued
          : t.orders.working({ shares: remaining === null ? '—' : f.shares(micros(remaining)) }),
      ...(order.expiresAt === null
        ? {}
        : {
            meta:
              order.tif === 'day'
                ? t.orders.expiresAtClose({ time: f.time(order.expiresAt) })
                : f.dateTime(order.expiresAt),
          }),
      state: 'now',
    });
  } else if (order.status !== 'filled') {
    const title =
      order.status === 'canceled'
        ? order.cancelReason === 'user'
          ? t.orders.canceledByYou
          : t.orderStatus.canceled
        : order.status === 'expired'
          ? t.orders.expiredAtClose
          : order.rejection
            ? copy.rejection(order.rejection, order.symbol).reason
            : t.orderStatus.rejected;
    steps.push({ id: 'closed', title, ...(closedAt ? { meta: closedAt } : {}), state: 'done' });
  }
  return steps;
}

function fillProgress(order: Order, { t, f }: Copy) {
  if (order.qtyMicros !== null && order.qtyMicros > 0) {
    const params = {
      filled: f.shares(micros(order.filledMicros)),
      total: f.shares(micros(order.qtyMicros)),
    };
    return {
      value: order.filledMicros / order.qtyMicros,
      text: t.orders.filledOf(params),
      a11y: t.orders.filledOfA11y(params),
    };
  }
  if (order.amountCents !== null) {
    const params = {
      filled: f.money(cents(order.filledNotionalCents)),
      total: f.money(cents(order.amountCents)),
    };
    return {
      value: order.filledNotionalCents / order.amountCents,
      text: t.orders.filledOf(params),
      a11y: t.orders.filledOfA11y(params),
    };
  }
  return null;
}

export function useOrderDrawer(id: string) {
  const copy = useCopy();
  const { t, f, m } = copy;
  const query = useOrder(id);
  const stocks = useStocks();
  const cancel = useCancelOrder();
  const modify = useModifyOrder();
  const [editing, setEditing] = useState(false);
  const [priceText, setPriceText] = useState('');
  const [qtyText, setQtyText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const order = query.data;
  const outcome = cancel.data?.outcome;

  const view = order
    ? (() => {
        const price = orderPriceTicks(order);
        const realized = order.fills.reduce((sum, fill) => sum + fill.realizedCents, 0);
        const sector = stocks.data?.find((stock) => stock.symbol === order.symbol)?.sector;
        return {
          id: order.id,
          symbol: order.symbol,
          status: order.status,
          statusLabel:
            order.status === 'partially_filled' ? t.orders.partial : t.orderStatus[order.status],
          title: `${(order.side === 'buy' ? t.ticket.buyTitle : t.ticket.sellTitle)({ symbol: order.symbol })} · ${t.ticket.types[order.type]}`,
          subtitle: orderTypeLabel(order, copy),
          progress: fillProgress(order, copy),
          avg:
            order.avgFillTicks === null
              ? null
              : t.orders.avg({ price: f.price(ticks(order.avgFillTicks)) }),
          timeline: orderTimeline(order, copy),
          sector: sector ?? 'tech',
          soFar: {
            label: order.side === 'sell' ? t.orders.proceedsSoFar : t.orders.costSoFar,
            value: f.money(cents(order.filledNotionalCents)),
          },
          realized:
            order.side === 'sell'
              ? {
                  label: t.orders.realizedPl,
                  value: f.money(cents(realized), { signed: true }),
                  direction: direction(realized),
                }
              : null,
          cancellable: CANCELLABLE.includes(order.status) && outcome !== 'already_filled',
          modifiable:
            (order.status === 'open' || order.status === 'partially_filled') &&
            (price !== null || order.qtyMicros !== null),
          editPrice: price !== null,
          editQty: order.qtyMicros !== null && order.amountCents === null,
        };
      })()
    : null;

  const patch = (): ModifyOrderRequest | null => {
    if (!order) return null;
    const next: ModifyOrderRequest = {};
    if (priceText) {
      const ticks = parseTicks(priceText);
      if (!ticks) return null;
      if (order.type === 'stop') next.stopTicks = ticks;
      else next.limitTicks = ticks;
    }
    if (qtyText) {
      const micros = parseMicros(qtyText);
      if (!micros) return null;
      next.qtyMicros = micros;
    }
    return Object.keys(next).length > 0 ? next : null;
  };

  return {
    order: view,
    isLoading: query.isPending,
    isError: query.isError && !order,
    editing,
    priceText,
    qtyText,
    cancelling: cancel.isPending,
    saving: modify.isPending,
    editError: invalid ? m.orders.modifyInvalid : undefined,
    notice:
      outcome === 'already_filled'
        ? {
            tone: 'info' as const,
            title: t.orders.alreadyFilledTitle,
            body: t.orders.alreadyFilledBody,
          }
        : outcome === 'canceled'
          ? { tone: 'neutral' as const, title: t.orders.canceled, body: '' }
          : cancel.isError
            ? { tone: 'neg' as const, title: m.orders.cancelError, body: '' }
            : modify.isError
              ? { tone: 'neg' as const, title: m.orders.modifyError, body: '' }
              : null,
    labels: {
      title: t.orders.details,
      close: t.common.close,
      modify: t.orders.modify,
      cancelRemaining: order?.filledMicros ? t.orders.cancelRemaining : t.orders.cancelOrder,
      newPrice: m.orders.newPrice,
      newQuantity: m.orders.newQuantity,
      save: m.orders.saveChanges,
      discard: t.common.discard,
      loadError: m.orders.loadError,
      retry: t.common.retry,
    },
    actions: {
      retry: () => void query.refetch(),
      cancel: () => {
        cancel.mutate(id);
      },
      startEdit: () => {
        setEditing(true);
      },
      stopEdit: () => {
        setEditing(false);
        setPriceText('');
        setQtyText('');
        setInvalid(false);
      },
      setPriceText: (text: string) => {
        setPriceText(text);
        setInvalid(false);
      },
      setQtyText: (text: string) => {
        setQtyText(text);
        setInvalid(false);
      },
      save: () => {
        const body = patch();
        if (!body) {
          setInvalid(true);
          return;
        }
        modify.mutate(
          { id, patch: body },
          {
            onSuccess: () => {
              setEditing(false);
              setPriceText('');
              setQtyText('');
            },
          },
        );
      },
    },
  };
}
