import * as Haptics from 'expo-haptics';
import { useState } from 'react';

import { type CancelOrderResponse, type Order } from '@sarwa/contracts';
import {
  cents,
  direction,
  type Direction,
  micros,
  orderFill,
  parseTicks,
  ticks,
  toTradeQuote,
  useCancelOrder,
  useLiveSymbols,
  useModifyOrder,
  useOrder,
  useQuote,
} from '@sarwa/core';

import { type Copy, useCopy } from '../../lib/i18n';
import { useStockIndex } from '../../lib/sectors';
import { isWorking, orderAmount, orderTypeLine } from './order-copy';
import { orderTimeline } from './order-timeline';

type CancelOutcome = CancelOrderResponse['outcome'];

function fillProgress(order: Order, { t, f }: Copy) {
  const avg = orderFill(order).avgFillTicks;
  const byShares = order.qtyMicros !== null;
  const done = byShares ? order.filledMicros : order.filledNotionalCents;
  const total = byShares ? (order.qtyMicros ?? 0) : (order.amountCents ?? 0);
  const show = (value: number) => (byShares ? f.shares(micros(value)) : f.money(cents(value)));
  return {
    fraction: total > 0 ? done / total : 0,
    filled: show(done),
    total: show(total),
    label: t.orders.filledOfA11y({ filled: show(done), total: show(total) }),
    avg: avg === null ? null : t.orders.avg({ price: f.price(avg) }),
  };
}

function summaryRows(order: Order, lastTicks: number | null, { t, f }: Copy) {
  const realized = order.fills.reduce((sum, fill) => sum + fill.realizedCents, 0);
  const rows: { key: string; label: string; value: string; direction: Direction | null }[] = [
    {
      key: 'notional',
      label: order.side === 'sell' ? t.orders.proceedsSoFar : t.orders.costSoFar,
      value: f.money(cents(order.filledNotionalCents)),
      direction: null,
    },
  ];
  if (order.side === 'sell' && order.fills.length > 0) {
    rows.push({
      key: 'realized',
      label: t.orders.realizedPl,
      value: f.money(cents(realized), { signed: true }),
      direction: direction(realized),
    });
  }
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

  const working = order ? isWorking(order) : false;
  const priced = order?.type === 'limit' || order?.type === 'stop';

  return {
    isLoading: query.isPending,
    isError: query.isError && !order,
    order: order && {
      symbol: order.symbol,
      sector: sectorOf(order.symbol),
      status: order.status,
      title: `${order.side === 'buy' ? t.ticket.buyTitle({ symbol }) : t.ticket.sellTitle({ symbol })} · ${t.ticket.types[order.type]}`,
      subtitle: `${orderAmount(order, copy)} · ${orderTypeLine(order, copy)}`,
      progress: order.status === 'rejected' ? null : fillProgress(order, copy),
      timeline: orderTimeline(order, copy),
      rows: summaryRows(order, quote ? toTradeQuote(quote).lastTicks : null, copy),
    },
    outcome,
    canModify: working && priced,
    canCancel: working,
    cancelLabel:
      order?.status === 'partially_filled' ? t.orders.cancelRemaining : t.orders.cancelOrder,
    isCanceling: cancel.isPending,
    cancelFailed: cancel.isError,
    modify: {
      open: editing,
      label: order?.type === 'stop' ? t.ticket.stopPrice : t.ticket.limitPrice,
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
