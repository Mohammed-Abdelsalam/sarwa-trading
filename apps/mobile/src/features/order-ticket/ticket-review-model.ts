import { type Ticket, type ticketReviewView } from '@sarwa/core';

import { type Copy } from '../../lib/i18n';
import { type Row } from './ticket-entry-model';

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

export function reviewRows(
  ticket: Ticket,
  review: NonNullable<ReturnType<typeof ticketReviewView>>,
  { t, f }: Copy,
): Row[] {
  const draft = ticket.draft;
  const rows: Row[] = draft
    ? [
        {
          key: 'type',
          label: t.ticket.orderType,
          value: `${t.ticket.types[draft.type]} · ${t.ticket.tif[draft.tif]}`,
        },
      ]
    : [];
  rows.push(...review.rows);
  if (draft?.side === 'buy') {
    rows.push({
      key: 'after',
      label: t.ticket.buyingPowerAfter,
      value: f.money(ticket.buyingPowerAfterCents),
    });
  }
  return [...rows, { ...review.total, total: true }];
}
