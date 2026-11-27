import { type TradingStatus } from '@sarwa/contracts';
import {
  cents,
  type Ticket,
  ticketBlockCopy,
  ticketEntryView,
  ticketReviewView,
} from '@sarwa/core';
import { type EstimateRow } from '@sarwa/ui';

import { type Copy } from '../../lib/i18n';

export function entryView(
  ticket: Ticket,
  symbol: string,
  status: TradingStatus | undefined,
  copy: Copy,
) {
  const { t, f } = copy;
  const { form, estimate } = ticket;
  const shared = ticketEntryView(ticket, { symbol, status }, copy);
  // Loading only relabels the button; it is not a gate worth a callout.
  const block = ticket.blockReason;
  const gate = block && !('field' in block) && block.code !== 'STATUS_LOADING' ? block : null;

  return {
    ...shared,
    side: form.side,
    type: form.type,
    tif: form.tif,
    sizeMode: form.sizeMode,
    currency: f.currencyAffix(),
    size: { ...shared.size, hint: shared.size.hint || undefined },
    estimate: {
      rows: [
        {
          label: form.side === 'buy' ? t.ticket.estCost : t.ticket.estProceeds,
          value: estimate ? f.money(estimate.notionalCents) : '—',
        },
        { label: t.ticket.estFees, value: f.money(estimate?.feesCents ?? cents(0)) },
        { label: t.ticket.buyingPower, value: f.money(ticket.buyingPowerCents) },
      ] satisfies EstimateRow[],
      total: {
        label: t.ticket.afterOrder,
        value: f.money(ticket.buyingPowerAfterCents),
      } satisfies EstimateRow,
    },
    gate: gate ? ticketBlockCopy(gate, symbol, copy) : null,
    marketClosed: gate ? null : shared.marketClosed,
    canReview: ticket.canReview,
  };
}

export function reviewView(
  ticket: Ticket,
  { symbol, mod }: { symbol: string; mod: string },
  copy: Copy,
) {
  const { t, f, m } = copy;
  const shared = ticketReviewView(ticket, symbol, copy);
  const { draft } = ticket;
  if (!shared || !draft) return null;
  const buying = draft.side === 'buy';
  const priceTicks = draft.limitTicks ?? draft.stopTicks;
  const typeLabel = `${t.ticket.types[draft.type]}${priceTicks === undefined ? '' : ` ${f.price(priceTicks)}`}`;
  const detail =
    draft.type === 'limit' && priceTicks !== undefined
      ? t.ticket.limitHint({ price: f.price(priceTicks) })
      : draft.type === 'market'
        ? buying
          ? t.ticket.marketHintBuy
          : t.ticket.marketHintSell
        : undefined;

  return {
    ...shared,
    title: shared.headline,
    subtitle: [
      m.ticket.summaryLine({
        type: typeLabel,
        tif: draft.type === 'market' ? t.ticket.tif.day : t.ticket.tif[draft.tif],
      }),
      detail,
    ]
      .filter(Boolean)
      .join(' — '),
    countdown: shared.countdown && {
      remaining: shared.countdown.fraction,
      label: shared.countdown.a11y,
      text: `${shared.countdown.label} · ${t.ticket.autoRefreshes}`,
    },
    error: shared.error && { ...shared.error, retry: t.common.retry },
    placeShortcut: `${mod}↵`,
    heading: t.ticket.review,
    edit: t.common.edit,
    editA11y: t.orders.editA11y,
  };
}
