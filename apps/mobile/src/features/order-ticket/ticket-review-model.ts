import { type Order } from '@sarwa/contracts';
import { cents, micros, type OrderFill, toTradeQuote } from '@sarwa/core';

import { type Copy } from '../../lib/i18n';
import { type Row, type Ticket } from './ticket-entry-model';

const MS_PER_S = 1000;

export function reviewHeadline(ticket: Ticket, symbol: string, { t, f }: Copy): string {
  const { draft, estimate } = ticket;
  const buying = draft?.side !== 'sell';
  if (draft?.size.kind === 'amount') {
    const amount = f.money(draft.size.cents);
    return buying
      ? t.ticket.buyAmountOf({ amount, symbol })
      : t.ticket.sellAmountOf({ amount, symbol });
  }
  const shares = f.shares(
    draft?.size.kind === 'shares' ? draft.size.micros : (estimate?.qtyMicros ?? micros(0)),
  );
  return buying ? t.ticket.buyShares({ shares, symbol }) : t.ticket.sellShares({ shares, symbol });
}

export function reviewSubline(ticket: Ticket, { t, f }: Copy): string {
  const { draft } = ticket;
  if (!draft) return '';
  if (draft.type === 'limit' && draft.limitTicks !== undefined) {
    return `${t.ticket.types.limit} · ${t.ticket.limitHint({ price: f.price(draft.limitTicks) })}`;
  }
  if (draft.type === 'stop' && draft.stopTicks !== undefined) {
    const price = f.price(draft.stopTicks);
    return draft.side === 'buy'
      ? t.orders.triggersAbove({ price })
      : t.orders.triggersBelow({ price });
  }
  return draft.side === 'buy' ? t.ticket.marketHintBuy : t.ticket.marketHintSell;
}

export function reviewRows(ticket: Ticket, { t, f }: Copy): Row[] {
  const { draft, estimate } = ticket;
  if (!draft || !estimate) return [];
  const buying = draft.side === 'buy';
  const priceLabel =
    draft.type === 'market'
      ? buying
        ? t.ticket.estPriceAsk
        : t.ticket.estPriceBid
      : draft.type === 'limit'
        ? t.ticket.limitPrice
        : t.ticket.stopPrice;
  const rows: Row[] = [
    {
      key: 'type',
      label: t.ticket.orderType,
      value: `${t.ticket.types[draft.type]} · ${t.ticket.tif[draft.tif]}`,
    },
    { key: 'price', label: priceLabel, value: f.price(estimate.priceTicks) },
    { key: 'shares', label: t.ticket.estShares, value: f.shares(estimate.qtyMicros) },
    { key: 'fees', label: t.ticket.estFees, value: f.money(estimate.feesCents) },
  ];
  if (buying) {
    rows.push({
      key: 'after',
      label: t.ticket.buyingPowerAfter,
      value: f.money(ticket.buyingPowerAfterCents),
    });
  }
  rows.push({
    key: 'total',
    label: buying ? t.ticket.estTotal : t.ticket.estProceeds,
    value: f.money(estimate.notionalCents),
    total: true,
  });
  return rows;
}

export function quoteCountdown(ticket: Ticket, { t, f }: Copy) {
  const left = ticket.quoteMsLeft;
  if (left === null) return null;
  return {
    label: t.ticket.quoteValid(f.count(Math.ceil(left / MS_PER_S))),
    fraction: left / ticket.quoteValidityMs,
  };
}

export function restingNote(ticket: Ticket, { t, f }: Copy): string | null {
  const { draft, reviewedQuote } = ticket;
  if (!ticket.restingLimit || !draft?.limitTicks || !reviewedQuote) return null;
  const quote = toTradeQuote(reviewedQuote);
  const price = f.price(draft.limitTicks);
  return draft.side === 'buy'
    ? t.ticket.restingBuy({ ask: f.price(quote.askTicks), price })
    : t.ticket.restingSell({ bid: f.price(quote.bidTicks), price });
}

export type ResultTone = 'pos' | 'brand' | 'info' | 'neg';

export function resultHeadline(order: Order, symbol: string, opensAt: number | null, copy: Copy) {
  const { t, f, rejection } = copy;
  const traded = {
    shares: f.shares(micros(order.filledMicros)),
    symbol,
    amount: f.money(cents(order.filledNotionalCents)),
  };
  switch (order.status) {
    case 'filled':
    case 'partially_filled':
      return {
        tone: 'pos' as ResultTone,
        title:
          order.status === 'filled' ? t.ticket.filledTitle : t.notifications.orderPartiallyFilled,
        body: order.side === 'buy' ? t.ticket.youBought(traded) : t.ticket.youSold(traded),
      };
    case 'queued':
      return {
        tone: 'brand' as ResultTone,
        title: t.ticket.queuedTitle,
        body: opensAt === null ? '' : t.ticket.queuedBody({ time: f.dateTime(opensAt) }),
      };
    case 'open':
      return { tone: 'info' as ResultTone, title: t.ticket.placedTitle, body: t.ticket.placedBody };
    case 'rejected':
      return {
        tone: 'neg' as ResultTone,
        title: t.notifications.orderRejected,
        body: order.rejection ? rejection(order.rejection, symbol).explanation : '',
      };
    case 'canceled':
    case 'expired':
      return { tone: 'neg' as ResultTone, title: t.orderStatus[order.status], body: '' };
  }
}

export function resultRows(order: Order, fill: OrderFill, { t, f }: Copy): Row[] {
  const rows: Row[] = [];
  if (fill.avgFillTicks !== null) {
    rows.push({ key: 'avg', label: t.ticket.avgFillPrice, value: f.price(fill.avgFillTicks) });
  }
  if (fill.slippageCents !== null) {
    rows.push({
      key: 'slip',
      label: t.ticket.vsQuote,
      value: t.ticket.slippage({ amount: f.money(fill.slippageCents, { signed: true }) }),
    });
  }
  if (order.filledMicros > 0) {
    rows.push({
      key: 'at',
      label: t.ticket.filledAt,
      value: f.time(order.closedAt ?? order.updatedAt, { seconds: true }),
    });
  }
  rows.push({ key: 'id', label: t.ticket.orderId, value: order.id });
  return rows;
}
