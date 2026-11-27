import { type TradingStatus } from '@sarwa/contracts';
import { absolute, cents, type TicketBlock, toTradeQuote, type useOrderTicket } from '@sarwa/core';
import { type EstimateRow } from '@sarwa/ui';

import { type Copy } from '../../lib/i18n';

export type Ticket = ReturnType<typeof useOrderTicket>;
type Session = TradingStatus['session'] | undefined;
type Rejection = Parameters<Copy['rejection']>[0];

export interface Gate {
  title: string;
  body: string;
}

export function blockCopy(block: TicketBlock, symbol: string, copy: Copy): Gate {
  const { reason, explanation } = copy.rejection(block, symbol);
  return { title: reason, body: explanation };
}

function fieldError(issue: Rejection | undefined, symbol: string, copy: Copy) {
  return issue ? copy.rejection(issue, symbol).explanation : undefined;
}

export function entryView(ticket: Ticket, symbol: string, session: Session, copy: Copy) {
  const { t, f } = copy;
  const { form, estimate } = ticket;
  const buying = form.side === 'buy';
  const priceTicks = ticket.draft?.limitTicks ?? ticket.draft?.stopTicks;
  const closed = session !== undefined && !session.isOpen && form.type === 'market';
  // Loading only relabels the button; it is not a gate worth a callout.
  const block = ticket.blockReason;
  const gateBlock = block && !('field' in block) && block.code !== 'STATUS_LOADING' ? block : null;

  let priceHint: string | undefined;
  const bps = ticket.distanceBps;
  if (priceTicks !== undefined && bps !== null) {
    const pct = f.percent(absolute(bps));
    priceHint =
      form.type === 'stop'
        ? (buying ? t.ticket.stopHintBuy : t.ticket.stopHintSell)({ price: f.price(priceTicks) })
        : [
            bps < 0 ? t.ticket.belowLast({ pct }) : t.ticket.aboveLast({ pct }),
            ticket.collar &&
              t.ticket.collar({
                min: f.price(ticket.collar.minTicks),
                max: f.price(ticket.collar.maxTicks),
              }),
          ]
            .filter(Boolean)
            .join(' · ');
  }

  const reviewLabel = closed
    ? t.ticket.queueForOpen
    : buying
      ? t.ticket.reviewBuy
      : t.ticket.reviewSell;

  return {
    side: form.side,
    type: form.type,
    tif: form.tif,
    sizeMode: form.sizeMode,
    sellSuffix:
      ticket.sellableMicros > 0
        ? t.common.sharesShort({ shares: f.shares(ticket.sellableMicros) })
        : undefined,
    typeHint:
      form.type === 'market'
        ? buying
          ? t.ticket.marketHintBuy
          : t.ticket.marketHintSell
        : undefined,
    price:
      form.type === 'market'
        ? null
        : {
            label: form.type === 'limit' ? t.ticket.limitPrice : t.ticket.stopPrice,
            value: form.type === 'limit' ? form.limitText : form.stopText,
            hint: priceHint,
            error: fieldError(ticket.fieldErrors[form.type], symbol, copy),
          },
    size: {
      value: form.sizeMode === 'amount' ? form.amountText : form.qtyText,
      hint:
        form.sizeMode === 'amount' && estimate && estimate.qtyMicros > 0
          ? (buying ? t.ticket.sharesAtAsk : t.ticket.sharesAtBid)({
              shares: f.shares(estimate.qtyMicros),
              price: f.price(estimate.priceTicks),
            })
          : undefined,
      error: fieldError(ticket.fieldErrors.size, symbol, copy),
    },
    estimate: {
      rows: [
        {
          label: buying ? t.ticket.estCost : t.ticket.estProceeds,
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
    gate: gateBlock ? blockCopy(gateBlock, symbol, copy) : null,
    marketClosed:
      closed && !gateBlock
        ? {
            title: t.ticket.marketClosedTitle,
            body: t.ticket.marketClosedBody({ time: f.dateTime(session.opensAt) }),
          }
        : null,
    canReview: ticket.canReview,
    reviewLabel: block ? blockCopy(block, symbol, copy).title : reviewLabel,
  };
}

export function reviewView(
  ticket: Ticket,
  { symbol, mod }: { symbol: string; mod: string },
  copy: Copy,
) {
  const { t, f, m } = copy;
  const { draft, estimate } = ticket;
  if (!draft || !estimate) return null;
  const buying = draft.side === 'buy';
  const shares = f.shares(estimate.qtyMicros);
  const priceTicks = draft.limitTicks ?? draft.stopTicks;
  const reviewed = ticket.reviewedQuote ? toTradeQuote(ticket.reviewedQuote) : null;
  const sending = ticket.submitStatus === 'sending';

  const title =
    draft.size.kind === 'amount' && draft.type === 'market'
      ? (buying ? t.ticket.buyAmountOf : t.ticket.sellAmountOf)({
          amount: f.money(draft.size.cents),
          symbol,
        })
      : (buying ? t.ticket.buyShares : t.ticket.sellShares)({ shares, symbol });
  const typeLabel = `${t.ticket.types[draft.type]}${priceTicks === undefined ? '' : ` ${f.price(priceTicks)}`}`;
  const detail =
    draft.type === 'limit' && priceTicks !== undefined
      ? t.ticket.limitHint({ price: f.price(priceTicks) })
      : draft.type === 'market'
        ? buying
          ? t.ticket.marketHintBuy
          : t.ticket.marketHintSell
        : undefined;

  const rows: EstimateRow[] = [
    priceTicks === undefined
      ? {
          label: buying ? t.ticket.estPriceAsk : t.ticket.estPriceBid,
          value: f.price(estimate.priceTicks),
        }
      : {
          label: draft.type === 'limit' ? t.ticket.limitPrice : t.ticket.stopPrice,
          value: f.price(priceTicks),
        },
    { label: t.ticket.quantity, value: t.ticket.quantityShares({ shares }) },
    ...(buying ? [{ label: t.ticket.reservedCash, value: f.money(estimate.holdCents) }] : []),
    { label: t.ticket.fees, value: f.money(estimate.feesCents) },
  ];
  const total: EstimateRow = buying
    ? {
        label: draft.type === 'market' ? t.ticket.estTotal : t.ticket.maxCost,
        value: f.money(draft.type === 'market' ? estimate.notionalCents : estimate.holdCents),
      }
    : { label: t.ticket.estProceeds, value: f.money(estimate.notionalCents) };

  const msLeft = ticket.quoteMsLeft;

  return {
    title,
    subtitle: [
      m.ticket.summaryLine({
        type: typeLabel,
        tif: draft.type === 'market' ? t.ticket.tif.day : t.ticket.tif[draft.tif],
      }),
      detail,
    ]
      .filter(Boolean)
      .join(' — '),
    rows,
    total,
    countdown:
      msLeft === null
        ? null
        : {
            remaining: msLeft / ticket.quoteValidityMs,
            label: t.ticket.quoteValidityA11y,
            text: `${t.ticket.quoteValid(f.count(Math.ceil(msLeft / 1000)))} · ${t.ticket.autoRefreshes}`,
          },
    largeOrder: ticket.needsLargeConfirm
      ? {
          title: t.ticket.largeOrderTitle,
          body: t.ticket.largeOrderBody({ pct: f.percent(ticket.equityShareBps) }),
        }
      : null,
    resting:
      ticket.restingLimit && reviewed && priceTicks !== undefined
        ? buying
          ? t.ticket.restingBuy({ ask: f.price(reviewed.askTicks), price: f.price(priceTicks) })
          : t.ticket.restingSell({ bid: f.price(reviewed.bidTicks), price: f.price(priceTicks) })
        : null,
    sending,
    error:
      ticket.submitStatus === 'error'
        ? { title: t.ticket.sendFailed, body: t.ticket.sendFailedBody, retry: t.common.retry }
        : null,
    placeLabel: sending
      ? t.orderStatus.sending
      : ticket.needsLargeConfirm
        ? t.ticket.largeOrderConfirm
        : buying
          ? t.ticket.placeBuy
          : t.ticket.placeSell,
    placeShortcut: `${mod}↵`,
    heading: t.ticket.review,
    edit: t.common.edit,
    editA11y: t.orders.editA11y,
  };
}
