import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';

import { type Order } from '@sarwa/contracts';
import {
  absolute,
  applyKeypadKey,
  bps,
  type KeypadKey,
  marketPill,
  micros,
  type QuickAmount,
  type SizeMode,
  useHalt,
  useLiveStatus,
  useOrderTicket,
  usePortfolio,
  useTradingStatus,
} from '@sarwa/core';

import { usePlainControls } from '../../lib/a11y';
import { type Copy, localDigits, useCopy } from '../../lib/i18n';
import { useStockIndex } from '../../lib/sectors';
import {
  amountDisplay,
  blockLabel,
  entryRows,
  gates,
  marketClosedGate,
  quickChips,
  quoteLine,
  type Ticket,
  upfrontBlocks,
} from './ticket-entry-model';
import {
  quoteCountdown,
  restingNote,
  resultHeadline,
  resultRows,
  reviewHeadline,
  reviewRows,
  reviewSubline,
} from './ticket-review-model';

type Side = Order['side'];
type Focus = 'size' | 'price';

const MONEY_DECIMALS = 2;
const SHARE_DECIMALS = 6;

function priceField(ticket: Ticket, focus: Focus, symbol: string, copy: Copy) {
  const { form, fieldErrors } = ticket;
  if (form.type === 'market') return null;
  const limit = form.type === 'limit';
  const error = fieldErrors[limit ? 'limit' : 'stop'];
  return {
    label: limit ? copy.t.ticket.limitPrice : copy.t.ticket.stopPrice,
    value: localDigits(limit ? form.limitText : form.stopText, copy.digits),
    focused: focus === 'price',
    error: error ? copy.rejection(error, symbol).explanation : undefined,
    hint: priceHint(ticket, copy),
  };
}

function priceHint({ form, distanceBps, collar }: Ticket, { t, f }: Copy): string | undefined {
  if (distanceBps === null || distanceBps === 0) return undefined;
  const pct = f.percent(absolute(distanceBps));
  const distance = distanceBps < 0 ? t.ticket.belowLast({ pct }) : t.ticket.aboveLast({ pct });
  if (!collar || form.type !== 'limit') return distance;
  return `${distance} · ${t.ticket.collar({ min: f.price(collar.minTicks), max: f.price(collar.maxTicks) })}`;
}

export function useOrderTicketScreen(symbol: string, initialSide: Side) {
  const copy = useCopy();
  const { t, f, rejection } = copy;
  const ticket = useOrderTicket({ symbol, initialSide });
  const status = useTradingStatus().data;
  const halt = useHalt(symbol);
  const portfolio = usePortfolio();
  const { sectorOf } = useStockIndex();
  const pill = marketPill(useLiveStatus(), useTradingStatus().data?.session, copy);
  const plainConfirm = usePlainControls();
  const [focus, setFocus] = useState<Focus>('size');
  const [largeConfirmed, setLargeConfirmed] = useState(false);
  const { form, estimate } = ticket;
  const buying = form.side === 'buy';
  const blocks = upfrontBlocks(ticket, status, halt);
  const block = ticket.blockReason ?? blocks[0] ?? null;
  const closedGate = blocks.some((b) => b.code === 'MARKET_CLOSED')
    ? null
    : marketClosedGate(ticket, status, copy);
  const sizeError = ticket.fieldErrors.size;
  const order = ticket.result?.order ?? null;
  const position = portfolio.summary?.positions.find((p) => p.symbol === symbol) ?? null;
  const confirmLabel = buying ? t.ticket.buyTitle({ symbol }) : t.ticket.sellTitle({ symbol });

  const editField = (key: KeypadKey) => {
    if (focus === 'price' && form.type !== 'market') {
      const setter = form.type === 'limit' ? ticket.setLimitText : ticket.setStopText;
      setter(
        applyKeypadKey(form.type === 'limit' ? form.limitText : form.stopText, key, MONEY_DECIMALS),
      );
    } else if (form.sizeMode === 'amount') {
      ticket.setAmountText(applyKeypadKey(form.amountText, key, MONEY_DECIMALS));
    } else {
      ticket.setQtyText(applyKeypadKey(form.qtyText, key, SHARE_DECIMALS));
    }
  };

  return {
    step: ticket.step,
    symbol,
    sector: sectorOf(symbol),
    header: { title: confirmLabel, pill },
    entry: {
      side: form.side,
      buyLabel: t.common.buy,
      sellLabel: ticket.position
        ? t.ticket.sellHeld({ shares: f.shares(micros(ticket.position.qtyMicros)) })
        : t.common.sell,
      quote: quoteLine(ticket, copy),
      type: form.type,
      tif: form.tif,
      showTif: form.type !== 'market',
      sizeMode: form.sizeMode,
      amount: amountDisplay(ticket, copy),
      sizeFocused: focus === 'size',
      sizeError: sizeError ? rejection(sizeError, symbol).explanation : undefined,
      chips: quickChips(ticket, copy),
      price: priceField(ticket, focus, symbol, copy),
      gates: closedGate
        ? [closedGate, ...gates(blocks, ticket, halt, symbol, copy)]
        : gates(blocks, ticket, halt, symbol, copy),
      rows: entryRows(ticket, status, copy),
      bufferNote:
        estimate?.queued && status
          ? t.ticket.bufferNote({ pct: f.percent(bps(status.rules.closedMarketBufferBps)) })
          : null,
      button: {
        label: block
          ? blockLabel(block, symbol, copy)
          : estimate?.queued
            ? t.ticket.queueForOpen
            : t.ticket.review,
        blocked: block !== null,
        queued: estimate?.queued === true,
        disabled: !ticket.canReview,
      },
    },
    review: {
      headline: reviewHeadline(ticket, symbol, copy),
      subline: reviewSubline(ticket, copy),
      rows: reviewRows(ticket, copy),
      countdown: quoteCountdown(ticket, copy),
      note: t.paper.orderNote,
      resting: restingNote(ticket, copy),
      large:
        ticket.needsLargeConfirm && estimate
          ? {
              body: t.ticket.largeOrderBody({ pct: f.percent(ticket.equityShareBps) }),
              confirmed: largeConfirmed,
              toggleLabel: t.ticket.largeOrderToggle,
            }
          : null,
      confirm: {
        slideLabel: buying ? t.ticket.slideToBuy : t.ticket.slideToSell,
        buttonLabel: confirmLabel,
        caption: t.ticket.slideAlternative({ label: confirmLabel }),
        plain: plainConfirm,
        sending: ticket.submitStatus === 'sending',
        disabled:
          ticket.submitStatus === 'sending' ||
          ticket.blockReason !== null ||
          (ticket.needsLargeConfirm && !largeConfirmed),
      },
      sendingLabel: t.orderStatus.sending,
      error:
        ticket.submitStatus === 'error'
          ? { title: t.ticket.sendFailed, body: t.ticket.sendFailedBody }
          : null,
    },
    result:
      order && ticket.result
        ? {
            ...resultHeadline(order, symbol, status?.session.opensAt ?? null, copy),
            status: order.status,
            rows: resultRows(order, ticket.result, copy),
            position:
              position && order.filledMicros > 0
                ? [
                    {
                      key: 'shares',
                      label: t.ticket.newPosition,
                      value: t.common.sharesShort({ shares: f.shares(position.qtyMicros) }),
                    },
                    {
                      key: 'avg',
                      label: t.ticket.avgCost,
                      value: f.price(position.averageCostTicks),
                    },
                    { key: 'weight', label: t.ticket.weight, value: f.percent(position.weightBps) },
                  ]
                : null,
          }
        : null,
    actions: {
      close: () => {
        router.back();
      },
      setSide: ticket.setSide,
      setType: (type: Order['type']) => {
        ticket.setType(type);
        setFocus(type === 'market' ? 'size' : 'price');
      },
      setTif: ticket.setTif,
      setSizeMode: (mode: SizeMode) => {
        ticket.setSizeMode(mode);
        setFocus('size');
      },
      focusSize: () => {
        setFocus('size');
      },
      focusPrice: () => {
        setFocus('price');
      },
      key: editField,
      chooseQuickAmount: (amount: QuickAmount) => {
        setFocus('size');
        ticket.chooseQuickAmount(amount);
      },
      review: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setLargeConfirmed(false);
        ticket.review();
      },
      back: ticket.backToEntry,
      toggleLargeConfirm: () => {
        setLargeConfirmed((value) => !value);
      },
      submit: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        ticket.submit();
      },
      retry: ticket.retry,
      viewPosition: () => {
        router.dismissTo('/portfolio');
      },
      setAlert: () => {
        router.dismissTo({ pathname: '/alerts', params: { symbol } });
      },
    },
  };
}
