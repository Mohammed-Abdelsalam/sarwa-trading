import { type Order, type TradingStatus } from '@sarwa/contracts';
import { absolute, cents, micros, type OrderType, type Side } from '@sarwa/domain';

import { type I18n } from './hooks/i18n';
import { type useOrderTicket } from './hooks/order-ticket';
import { type TicketBlock } from './ticket';
import { type OrderFill, toTradeQuote } from './trading';

type Copy = Pick<I18n, 't' | 'f' | 'rejection'>;
export type Ticket = ReturnType<typeof useOrderTicket>;

export interface TicketRow {
  key: string;
  label: string;
  value: string;
}

export interface TicketNotice {
  title: string;
  body: string;
}

export type TicketResultTone = 'pos' | 'brand' | 'info' | 'neg';

const MS_PER_S = 1000;

export function ticketPriceLabel(type: OrderType, side: Side, { t }: Pick<Copy, 't'>): string {
  if (type === 'limit') return t.ticket.limitPrice;
  if (type === 'stop') return t.ticket.stopPrice;
  return side === 'buy' ? t.ticket.estPriceAsk : t.ticket.estPriceBid;
}

export function ticketBlockCopy(block: TicketBlock, symbol: string, copy: Copy): TicketNotice {
  const { reason, explanation } = copy.rejection(block, symbol);
  return { title: reason, body: explanation };
}

function priceHint(ticket: Ticket, { t, f }: Copy): string | undefined {
  const { form, distanceBps, collar, draft } = ticket;
  if (distanceBps === null || distanceBps === 0) return undefined;
  const stopTicks = draft?.stopTicks;
  if (form.type === 'stop' && stopTicks !== undefined) {
    return (form.side === 'buy' ? t.ticket.stopHintBuy : t.ticket.stopHintSell)({
      price: f.price(stopTicks),
    });
  }
  const pct = f.percent(absolute(distanceBps));
  const distance = distanceBps < 0 ? t.ticket.belowLast({ pct }) : t.ticket.aboveLast({ pct });
  if (!collar || form.type !== 'limit') return distance;
  return `${distance} · ${t.ticket.collar({ min: f.price(collar.minTicks), max: f.price(collar.maxTicks) })}`;
}

function sizeHint({ form, estimate }: Ticket, { t, f }: Copy): string {
  if (!estimate) return '';
  if (form.sizeMode === 'shares') return `≈ ${f.money(estimate.notionalCents)}`;
  if (estimate.qtyMicros <= 0) return '';
  const params = { shares: f.shares(estimate.qtyMicros), price: f.price(estimate.priceTicks) };
  if (form.type !== 'market') return `≈ ${params.shares} @ ${params.price}`;
  return form.side === 'buy' ? t.ticket.sharesAtAsk(params) : t.ticket.sharesAtBid(params);
}

// A market order sent while closed waits for the open, when the rules allow queueing it.
export function ticketMarketClosed(
  ticket: Ticket,
  status: TradingStatus | undefined,
  { t, f }: Copy,
): TicketNotice | null {
  if (!status || status.session.isOpen || ticket.form.type !== 'market') return null;
  if (!status.rules.queueWhenClosed) return null;
  return {
    title: t.ticket.marketClosedTitle,
    body: t.ticket.marketClosedBody({ time: f.dateTime(status.session.opensAt) }),
  };
}

export function ticketEntryView(
  ticket: Ticket,
  { symbol, status }: { symbol: string; status: TradingStatus | undefined },
  copy: Copy,
) {
  const { t, f } = copy;
  const { form, fieldErrors, blockReason } = ticket;
  const buying = form.side === 'buy';
  const fieldError = (issue: TicketBlock | undefined) =>
    issue ? copy.rejection(issue, symbol).explanation : undefined;
  const marketClosed = ticketMarketClosed(ticket, status, copy);
  return {
    typeHint:
      form.type === 'market'
        ? buying
          ? t.ticket.marketHintBuy
          : t.ticket.marketHintSell
        : undefined,
    sellSuffix:
      ticket.sellableMicros > 0
        ? t.common.sharesShort({ shares: f.shares(ticket.sellableMicros) })
        : undefined,
    price:
      form.type === 'market'
        ? null
        : {
            label: ticketPriceLabel(form.type, form.side, copy),
            value: form.type === 'limit' ? form.limitText : form.stopText,
            hint: priceHint(ticket, copy),
            error: fieldError(fieldErrors[form.type]),
          },
    size: {
      value: form.sizeMode === 'amount' ? form.amountText : form.qtyText,
      prefix: form.sizeMode === 'amount' ? f.currencyAffix() : '',
      hint: sizeHint(ticket, copy),
      error: fieldError(fieldErrors.size),
    },
    marketClosed,
    reviewLabel: blockReason
      ? ticketBlockCopy(blockReason, symbol, copy).title
      : marketClosed
        ? t.ticket.queueForOpen
        : buying
          ? t.ticket.reviewBuy
          : t.ticket.reviewSell,
  };
}

function headline(ticket: Ticket, symbol: string, { t, f }: Copy): string {
  const { draft, estimate } = ticket;
  const buying = draft?.side !== 'sell';
  if (draft?.size.kind === 'amount') {
    const amount = f.money(draft.size.cents);
    return (buying ? t.ticket.buyAmountOf : t.ticket.sellAmountOf)({ amount, symbol });
  }
  const shares = f.shares(
    draft?.size.kind === 'shares' ? draft.size.micros : (estimate?.qtyMicros ?? micros(0)),
  );
  return (buying ? t.ticket.buyShares : t.ticket.sellShares)({ shares, symbol });
}

export function ticketReviewView(ticket: Ticket, symbol: string, copy: Copy) {
  const { t, f } = copy;
  const { draft, estimate, reviewedQuote } = ticket;
  if (!draft || !estimate) return null;
  const buying = draft.side === 'buy';
  const priceTicks = draft.limitTicks ?? draft.stopTicks ?? estimate.priceTicks;
  const left = ticket.quoteMsLeft;
  const quote = reviewedQuote ? toTradeQuote(reviewedQuote) : null;
  const sending = ticket.submitStatus === 'sending';

  const rows: TicketRow[] = [
    {
      key: 'price',
      label: ticketPriceLabel(draft.type, draft.side, copy),
      value: f.price(priceTicks),
    },
    {
      key: 'shares',
      label: t.ticket.quantity,
      value: t.ticket.quantityShares({ shares: f.shares(estimate.qtyMicros) }),
    },
    ...(buying
      ? [{ key: 'reserved', label: t.ticket.reservedCash, value: f.money(estimate.holdCents) }]
      : []),
    { key: 'fees', label: t.ticket.fees, value: f.money(estimate.feesCents) },
  ];
  // A limit or stop buy may fill below its price, so what it can cost at most is the cash it holds.
  const total: TicketRow = buying
    ? {
        key: 'total',
        label: draft.type === 'market' ? t.ticket.estTotal : t.ticket.maxCost,
        value: f.money(draft.type === 'market' ? estimate.notionalCents : estimate.holdCents),
      }
    : { key: 'total', label: t.ticket.estProceeds, value: f.money(estimate.notionalCents) };

  return {
    headline: headline(ticket, symbol, copy),
    rows,
    total,
    countdown:
      left === null
        ? null
        : {
            fraction: left / ticket.quoteValidityMs,
            label: t.ticket.quoteValid(f.count(Math.ceil(left / MS_PER_S))),
            a11y: t.ticket.quoteValidityA11y,
          },
    largeOrder: ticket.needsLargeConfirm
      ? {
          title: t.ticket.largeOrderTitle,
          body: t.ticket.largeOrderBody({ pct: f.percent(ticket.equityShareBps) }),
        }
      : null,
    resting:
      ticket.restingLimit && quote && draft.limitTicks !== undefined
        ? buying
          ? t.ticket.restingBuy({ ask: f.price(quote.askTicks), price: f.price(draft.limitTicks) })
          : t.ticket.restingSell({ bid: f.price(quote.bidTicks), price: f.price(draft.limitTicks) })
        : null,
    sending,
    error:
      ticket.submitStatus === 'error'
        ? { title: t.ticket.sendFailed, body: t.ticket.sendFailedBody }
        : null,
    placeLabel: sending
      ? t.orderStatus.sending
      : ticket.needsLargeConfirm
        ? t.ticket.largeOrderConfirm
        : buying
          ? t.ticket.placeBuy
          : t.ticket.placeSell,
  };
}

export function ticketResultView(
  order: Order,
  fill: OrderFill,
  { symbol, opensAt }: { symbol: string; opensAt: number | null },
  copy: Copy,
): { tone: TicketResultTone; title: string; body: string; rows: TicketRow[] } {
  const { t, f } = copy;
  const rows: TicketRow[] = [];
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

  const traded = {
    shares: f.shares(micros(order.filledMicros)),
    symbol,
    amount: f.money(cents(order.filledNotionalCents)),
  };
  switch (order.status) {
    case 'filled':
    case 'partially_filled':
      return {
        tone: 'pos',
        title:
          order.status === 'filled' ? t.ticket.filledTitle : t.notifications.orderPartiallyFilled,
        body: order.side === 'buy' ? t.ticket.youBought(traded) : t.ticket.youSold(traded),
        rows,
      };
    case 'queued':
      return {
        tone: 'brand',
        title: t.ticket.queuedTitle,
        body: opensAt === null ? '' : t.ticket.queuedBody({ time: f.dateTime(opensAt) }),
        rows,
      };
    case 'open':
      return { tone: 'info', title: t.ticket.placedTitle, body: t.ticket.placedBody, rows };
    case 'rejected':
      return {
        tone: 'neg',
        title: t.notifications.orderRejected,
        body: order.rejection ? copy.rejection(order.rejection, symbol).explanation : '',
        rows,
      };
    case 'canceled':
    case 'expired':
      return { tone: 'neg', title: t.orderStatus[order.status], body: '', rows };
  }
}
