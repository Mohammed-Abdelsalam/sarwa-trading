import * as Haptics from 'expo-haptics';
import { useState } from 'react';

import { type CancelOrderResponse, type Order } from '@sarwa/contracts';
import {
  cancelLabel,
  fillProgress,
  isCancellable,
  type OrderAmountRow,
  orderRealized,
  orderSizeLabel,
  orderSoFar,
  orderTimeline,
  orderTitle,
  orderTypeLabel,
  parseTicks,
  ticks,
  toTradeQuote,
  useCancelOrder,
  useLiveSymbols,
  useModifyOrder,
  useOrder,
  useQuote,
  useStockIndex,
} from '@sarwa/core';

import { type Copy, useCopy } from '../../lib/i18n';

type CancelOutcome = CancelOrderResponse['outcome'];

function summaryRows(order: Order, lastTicks: number | null, copy: Copy) {
  const { t, f } = copy;
  const realized = orderRealized(order, copy);
  const rows: (OrderAmountRow & { key: string })[] = [
    { key: 'notional', ...orderSoFar(order, copy) },
  ];
  if (realized) rows.push({ key: 'realized', ...realized });
  if (lastTicks !== null) {
    rows.push({
      key: 'last',
      label: t.orders.lastPrice,
      value: f.price(ticks(lastTicks)),
      direction: null,
    });
  }
  return rows;
}

export function useOrderDetailScreen(id: string) {
  const copy = useCopy();
  const { t } = copy;
  const query = useOrder(id);
  const order = query.data;
  const symbol = order?.symbol ?? '';
  useLiveSymbols(symbol ? [symbol] : []);
  const quote = useQuote(symbol);
  const cancel = useCancelOrder();
  const modify = useModifyOrder();
  const { sectorOf } = useStockIndex();
  const [outcome, setOutcome] = useState<CancelOutcome | null>(null);
  const [editing, setEditing] = useState(false);
  const [priceText, setPriceText] = useState('');

  const working = order ? isCancellable(order) : false;
  const progress = order ? fillProgress(order, copy) : null;
  const priced = order?.type === 'limit' || order?.type === 'stop';

  return {
    isLoading: query.isPending,
    isError: query.isError && !order,
    order: order && {
      symbol: order.symbol,
      sector: sectorOf(order.symbol),
      status: order.status,
      title: orderTitle(order, copy),
      subtitle: `${orderSizeLabel(order, copy)} · ${orderTypeLabel(order, copy)}`,
      progress: progress && {
        fraction: progress.value,
        filled: progress.filled,
        total: progress.total,
        label: progress.a11y,
        avg: progress.avg,
      },
      timeline: orderTimeline(order, copy),
      rows: summaryRows(order, quote ? toTradeQuote(quote).lastTicks : null, copy),
    },
    outcome,
    canModify: working && priced,
    canCancel: working,
    cancelLabel: cancelLabel(order ?? { filledMicros: 0 }, copy),
    isCanceling: cancel.isPending,
    cancelFailed: cancel.isError,
    modify: {
      open: editing,
      label: order?.type === 'stop' ? t.ticket.stopPrice : t.ticket.limitPrice,
      prefix: copy.f.currencyAffix(),
      text: priceText,
      saving: modify.isPending,
      failed: modify.isError,
    },
    actions: {
      retry: () => void query.refetch(),
      cancel: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        cancel.mutate(id, {
          onSuccess: (response) => {
            setOutcome(response.outcome);
          },
        });
      },
      startModify: () => {
        setPriceText('');
        modify.reset();
        setEditing(true);
      },
      closeModify: () => {
        setEditing(false);
      },
      setPriceText,
      saveModify: () => {
        const ticks = parseTicks(priceText);
        if (!ticks || !order) return;
        modify.mutate(
          { id, patch: order.type === 'stop' ? { stopTicks: ticks } : { limitTicks: ticks } },
          {
            onSuccess: () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setEditing(false);
            },
          },
        );
      },
    },
  };
}
