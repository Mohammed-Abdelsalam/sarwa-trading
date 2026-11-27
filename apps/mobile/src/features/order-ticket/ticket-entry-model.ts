import { type Halt, type TradingStatus } from '@sarwa/contracts';
import {
  bps,
  cents,
  centsToDollars,
  centsToText,
  type Rejection,
  type Ticket,
  type TicketBlock,
  ticketBlockCopy,
  ticketMarketClosed,
  ticketPriceLabel,
  toTradeQuote,
} from '@sarwa/core';

import { type CalloutTone } from '../../components/ui/callout';
import { type Copy } from '../../lib/i18n';

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

export function blockLabel(block: TicketBlock, symbol: string, copy: Copy): string {
  return ticketBlockCopy(block, symbol, copy).title;
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
  const closed = ticketMarketClosed(ticket, status, copy);
  return closed && { key: 'closed', tone: 'warn', icon: 'clock', ...closed };
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

export function amountDisplay(
  ticket: Ticket,
  size: { value: string; prefix: string; hint: string },
  copy: Copy,
) {
  const { t, f } = copy;
  return {
    prefix: size.prefix,
    value: f.localDigits(size.value === '' ? '0' : size.value),
    suffix: ticket.form.sizeMode === 'amount' ? '' : ` ${t.ticket.shares}`,
    empty: size.value === '',
    hint: size.hint,
  };
}

export function quickChips(ticket: Ticket, { t, f }: Copy) {
  return ticket.quickAmounts.map((amount) => ({
    key: amount.key,
    label:
      amount.key === 'max'
        ? t.ticket.max
        : `${f.currencyAffix()}${f.number(centsToDollars(amount.cents))}`,
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
  const rows: Row[] = [
    {
      key: 'price',
      label: ticketPriceLabel(form.type, form.side, copy),
      value: f.price(estimate.priceTicks),
    },
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
