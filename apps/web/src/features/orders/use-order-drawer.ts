import { useState } from 'react';

import { type ModifyOrderRequest, type Order } from '@sarwa/contracts';
import {
  cancelLabel,
  fillProgress,
  isCancellable,
  orderPriceTicks,
  orderRealized,
  orderSoFar,
  orderTimeline,
  orderTitle,
  orderTypeLabel,
  parseMicros,
  parseTicks,
  useCancelOrder,
  useModifyOrder,
  useOrder,
  useStocks,
} from '@sarwa/core';
import { type TimelineStep } from '@sarwa/ui';

import { type Copy, useCopy } from '../../lib/i18n';

// The web timeline has no failed state: a closed order's last step simply reads as done.
function timelineSteps(order: Order, copy: Copy): TimelineStep[] {
  return orderTimeline(order, copy).map((step) => ({
    id: step.key,
    title: step.title,
    ...(step.detail ? { meta: step.detail } : {}),
    state: step.state === 'failed' ? 'done' : step.state,
  }));
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
        const progress = fillProgress(order, copy);
        const sector = stocks.data?.find((stock) => stock.symbol === order.symbol)?.sector;
        return {
          id: order.id,
          symbol: order.symbol,
          status: order.status,
          statusLabel:
            order.status === 'partially_filled' ? t.orders.partial : t.orderStatus[order.status],
          title: orderTitle(order, copy),
          subtitle: orderTypeLabel(order, copy),
          progress,
          avg: progress?.avg ?? null,
          timeline: timelineSteps(order, copy),
          sector: sector ?? 'tech',
          soFar: orderSoFar(order, copy),
          realized: orderRealized(order, copy),
          cancellable: isCancellable(order) && outcome !== 'already_filled',
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
    currency: f.currencyAffix(),
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
      cancelRemaining: cancelLabel(order ?? { filledMicros: 0 }, copy),
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
