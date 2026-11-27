import { type Halt, type TradingStatus } from '@sarwa/contracts';
import {
  bps,
  cents,
  centsToDollars,
  centsToText,
  type Rejection,
  type TicketBlock,
  toTradeQuote,
  type useOrderTicket,
} from '@sarwa/core';

import { type CalloutTone } from '../../components/ui/callout';
import { type Copy, localDigits } from '../../lib/i18n';

export type Ticket = ReturnType<typeof useOrderTicket>;

export interface Row {
  key: string;
  label: string;
  value: string;
  total?: boolean;
}

export interface Gate {
  key: string;
  tone: CalloutTone;
  icon: 'pause' | 'clock' | 'wifi';
  title: string;
  body: string;
}

const HALT_CODES = new Set(['TRADING_DISABLED', 'MARKET_PAUSED', 'SYMBOL_HALTED']);

export function blockLabel(block: TicketBlock, symbol: string, { rejection }: Copy): string {
  return rejection(block, symbol).reason;
}

// Gates that don't need a typed order show up front, before any amount is entered.
export function upfrontBlocks(
  ticket: Ticket,
  status: TradingStatus | undefined,
  halt: Halt | null,
): Rejection[] {
  if (ticket.draft) return ticket.issues.filter((issue) => !('field' in issue));
  const found: Rejection[] = [];
  if (status && !status.tradingEnabled) found.push({ code: 'TRADING_DISABLED' });
  if (halt) found.push({ code: 'SYMBOL_HALTED' });
  return found;
}

export function gates(
  blocks: readonly Rejection[],
  ticket: Ticket,
  halt: Halt | null,
  symbol: string,
  copy: Copy,
): Gate[] {
  const { t, f, rejection } = copy;
  const list: Gate[] = blocks.map((block) => {
    const copyOf = rejection(block, symbol);
    const resumes =
      block.code === 'SYMBOL_HALTED' && halt?.resumesAt
        ? ` ${t.market.resumesAt({ time: f.time(halt.resumesAt) })}.`
        : '';
    return {
      key: block.code,
      tone: HALT_CODES.has(block.code) ? 'neg' : 'warn',
      icon: HALT_CODES.has(block.code) ? 'pause' : block.code === 'STALE_QUOTE' ? 'wifi' : 'clock',
      title: copyOf.reason,
      body: `${copyOf.explanation}${resumes}`,
    };
  });
  if (ticket.blockReason?.code === 'CONNECTION_NOT_LIVE') {
    const connection = rejection(ticket.blockReason, symbol);
    list.push({
      key: 'connection',
      tone: 'warn',
      icon: 'wifi',
      title: connection.reason,
      body: connection.explanation,
    });
  }
  return list;
}

export function marketClosedGate(
  ticket: Ticket,
  status: TradingStatus | undefined,
  copy: Copy,
): Gate | null {
  const { t, f } = copy;
  if (!status || status.session.isOpen || ticket.form.type !== 'market') return null;
  if (!status.rules.queueWhenClosed) return null;
  return {
    key: 'closed',
    tone: 'warn',
    icon: 'clock',
    title: t.ticket.marketClosedTitle,
    body: t.ticket.marketClosedBody({ time: f.dateTime(status.session.opensAt) }),
  };
}

export function quoteLine(ticket: Ticket, { t, f }: Copy) {
  if (!ticket.quote || ticket.spreadBps === null) return null;
  const q = toTradeQuote(ticket.quote);
  return {
    bid: t.ticket.bid({ price: f.price(q.bidTicks), size: f.shares(q.bidSizeMicros) }),
    ask: t.ticket.ask({ price: f.price(q.askTicks), size: f.shares(q.askSizeMicros) }),
    spread: t.ticket.spread({ pct: f.percent(ticket.spreadBps) }),
  };
}

export function amountDisplay(ticket: Ticket, copy: Copy) {
  const { t, digits } = copy;
  const { form, estimate } = ticket;
  const byAmount = form.sizeMode === 'amount';
  const text = byAmount ? form.amountText : form.qtyText;
  return {
    prefix: byAmount ? '$' : '',
    value: localDigits(text === '' ? '0' : text, digits),
    suffix: byAmount ? '' : ` ${t.ticket.shares}`,
    empty: text === '',
    hint: estimate ? amountHint(ticket, estimate, copy) : '',
  };
}

function amountHint(ticket: Ticket, estimate: NonNullable<Ticket['estimate']>, copy: Copy): string {
  const { t, f } = copy;
  const { form } = ticket;
  if (form.sizeMode === 'shares') return `≈ ${f.money(estimate.notionalCents)}`;
  const params = { shares: f.shares(estimate.qtyMicros), price: f.price(estimate.priceTicks) };
  if (form.type !== 'market') return `≈ ${params.shares} @ ${params.price}`;
  return form.side === 'buy' ? t.ticket.sharesAtAsk(params) : t.ticket.sharesAtBid(params);
}

export function quickChips(ticket: Ticket, { t, f }: Copy) {
  return ticket.quickAmounts.map((amount) => ({
    key: amount.key,
    label: amount.key === 'max' ? t.ticket.max : `$${f.number(centsToDollars(amount.cents))}`,
    selected:
      ticket.form.sizeMode === 'amount' &&
      ticket.form.amountText !== '' &&
      ticket.form.amountText === centsToText(amount.cents),
    amount,
  }));
}

export function entryRows(ticket: Ticket, status: TradingStatus | undefined, copy: Copy): Row[] {
  const { t, f } = copy;
  const { estimate, form } = ticket;
  const bp: Row = {
    key: 'bp',
    label: t.ticket.buyingPower,
    value: f.money(ticket.buyingPowerCents),
  };
  const fees: Row = {
    key: 'fees',
    label: t.ticket.estFees,
    value: f.money(estimate?.feesCents ?? cents(0)),
  };
  if (!estimate) return [bp, fees];
  if (estimate.queued && status) {
    return [
      { key: 'close', label: t.ticket.lastClose, value: f.price(estimate.priceTicks) },
      {
        key: 'cost',
        label: t.ticket.estCostAtClose,
        value: `≈ ${f.money(estimate.notionalCents)}`,
      },
      {
        key: 'reserved',
        label: t.ticket.reservedWithBuffer({
          pct: f.percent(bps(status.rules.closedMarketBufferBps)),
        }),
        value: f.money(estimate.holdCents),
      },
    ];
  }
  const buying = form.side === 'buy';
  const priceLabel =
    form.type === 'limit'
      ? t.ticket.limitPrice
      : form.type === 'stop'
        ? t.ticket.stopPrice
        : buying
          ? t.ticket.estPriceAsk
          : t.ticket.estPriceBid;
  const rows: Row[] = [
    { key: 'price', label: priceLabel, value: f.price(estimate.priceTicks) },
    form.sizeMode === 'amount'
      ? { key: 'shares', label: t.ticket.estShares, value: f.shares(estimate.qtyMicros) }
      : {
          key: 'cost',
          label: buying ? t.ticket.estCost : t.ticket.estProceeds,
          value: f.money(estimate.notionalCents),
        },
    fees,
    bp,
  ];
  if (buying) {
    rows.push({
      key: 'after',
      label: t.ticket.buyingPowerAfter,
      value: f.money(ticket.buyingPowerAfterCents),
    });
  }
  return rows;
}
