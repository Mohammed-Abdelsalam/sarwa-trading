import { type Route } from 'next';
import { useRouter } from 'next/navigation';

import { cents, micros, useOrderTicket, usePortfolio, useTradingStatus } from '@sarwa/core';
import { breakpoints } from '@sarwa/tokens';
import { type EstimateRow } from '@sarwa/ui';

import {
  isTyping,
  replaceSearchParam,
  useMediaQuery,
  useModKey,
  useSearchParam,
  useWindowKeyDown,
} from '../../lib/browser';
import { type Copy, useCopy } from '../../lib/i18n';
import { entryView, reviewView, type Ticket } from './ticket-copy';

export type PanelMode = 'panel' | 'drawer' | 'sheet';
type Side = 'buy' | 'sell';
type Session = ReturnType<typeof useTradingStatus>['data'];
type Summary = ReturnType<typeof usePortfolio>['summary'];

export function parseSide(value: string | null): Side | null {
  return value === 'buy' || value === 'sell' ? value : null;
}

export function resultView(
  ticket: Ticket,
  symbol: string,
  session: Session,
  summary: Summary,
  copy: Copy,
) {
  const { t, f } = copy;
  const result = ticket.result;
  if (!result) return null;
  const { order } = result;
  const buying = order.side === 'buy';

  if (order.status === 'filled') {
    const position = summary?.positions.find((p) => p.symbol === symbol);
    const rows: EstimateRow[] = [
      {
        label: t.ticket.avgFillPrice,
        value: result.avgFillTicks === null ? '—' : f.price(result.avgFillTicks),
      },
      {
        label: t.ticket.vsQuote,
        value: t.ticket.slippage({
          amount: f.money(result.slippageCents ?? cents(0), { signed: true }),
        }),
      },
      {
        label: t.ticket.filledAt,
        value: f.time(order.closedAt ?? order.updatedAt, { seconds: true }),
      },
      { label: t.ticket.orderId, value: order.id },
    ];
    return {
      tone: 'pos' as const,
      title: t.ticket.filledTitle,
      body: (buying ? t.ticket.youBought : t.ticket.youSold)({
        shares: f.shares(micros(order.filledMicros)),
        symbol,
        amount: f.money(cents(order.filledNotionalCents)),
      }),
      rows,
      position: position
        ? [
            {
              label: t.ticket.newPosition,
              value: t.ticket.quantityShares({ shares: f.shares(position.qtyMicros) }),
            },
            { label: t.ticket.avgCost, value: f.price(position.averageCostTicks) },
            { label: t.ticket.weight, value: f.percent(position.weightBps) },
          ]
        : [],
    };
  }
  if (order.status === 'queued') {
    return {
      tone: 'brand' as const,
      title: t.ticket.queuedTitle,
      body: t.ticket.queuedBody({ time: f.dateTime(session?.session.opensAt ?? order.createdAt) }),
      rows: [{ label: t.ticket.orderId, value: order.id }],
      position: [],
    };
  }
  if (order.status === 'rejected') {
    return {
      tone: 'neg' as const,
      title: t.notifications.orderRejected,
      body: order.rejection ? copy.rejection(order.rejection, symbol).explanation : '',
      rows: [{ label: t.ticket.orderId, value: order.id }],
      position: [],
    };
  }
  return {
    tone: 'info' as const,
    title:
      order.status === 'open' || order.status === 'partially_filled'
        ? t.ticket.placedTitle
        : t.orderStatus[order.status],
    body: t.ticket.placedBody,
    rows: [
      { label: t.orders.columns.status, value: t.orderStatus[order.status] },
      { label: t.ticket.orderId, value: order.id },
    ],
    position: [],
  };
}

// The ticket follows ?trade=buy|sell: the deep link opens it, B / S set it, closing clears it.
export function useOrderPanel(symbol: string) {
  const copy = useCopy();
  const { t, m } = copy;
  const router = useRouter();
  const trade = parseSide(useSearchParam('trade'));
  const wide = useMediaQuery(`(min-width: ${String(breakpoints.xl)}px)`);
  const tablet = useMediaQuery(`(min-width: ${String(breakpoints.md)}px)`);
  const mode: PanelMode = wide ? 'panel' : tablet ? 'drawer' : 'sheet';
  const ticket = useOrderTicket({ symbol, initialSide: trade ?? 'buy' });
  const status = useTradingStatus().data;
  const { summary } = usePortfolio();
  const mod = useModKey();
  const open = mode === 'panel' || trade !== null;

  const openTicket = (side: Side) => {
    replaceSearchParam('trade', side);
    if (ticket.step === 'entry') ticket.setSide(side);
  };
  const close = () => {
    replaceSearchParam('trade', null);
    if (ticket.step === 'result') ticket.reset();
    // A sending order keeps its review so the answer still shows when the ticket reopens.
    else if (ticket.step === 'review' && ticket.submitStatus !== 'sending') ticket.backToEntry();
  };

  useWindowKeyDown((event) => {
    const key = event.key.toLowerCase();
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      if (!open || ticket.step !== 'review') return;
      event.preventDefault();
      ticket.submit();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
    if (key === 'b' || key === 's') {
      event.preventDefault();
      openTicket(key === 'b' ? 'buy' : 'sell');
    } else if (event.key === 'Enter' && open && ticket.step === 'entry' && ticket.canReview) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('button, a, [role="option"]')) return;
      event.preventDefault();
      ticket.review();
    }
  });

  return {
    mode,
    open,
    step: ticket.step,
    entry: entryView(ticket, symbol, status?.session, copy),
    review: ticket.step === 'review' ? reviewView(ticket, { symbol, mod }, copy) : null,
    result: resultView(ticket, symbol, status, summary, copy),
    labels: {
      title: t.ticket.a11yLabel,
      side: t.ticket.sideLabel,
      buy: t.common.buy,
      sell: t.common.sell,
      orderType: m.ticket.orderTypeA11y,
      types: t.ticket.types,
      quantity: t.ticket.quantity,
      sizeMode: m.ticket.sizeModeA11y,
      amount: t.ticket.amount,
      shares: t.ticket.shares,
      timeInForce: t.ticket.timeInForce,
      tif: { day: t.ticket.tif.day, gtc: t.ticket.gtcLong(copy.f.count(90)) },
      disclosure: t.paper.tradingDisclosure,
      close: m.ticket.closeLabel,
      viewPosition: t.ticket.viewPosition,
      setAlert: t.ticket.setAlert,
      done: t.common.done,
      enterKey: '↵',
    },
    actions: {
      openTicket,
      close,
      setSide: ticket.setSide,
      setType: ticket.setType,
      setTif: ticket.setTif,
      setSizeMode: ticket.setSizeMode,
      setSize: (text: string) => {
        if (ticket.form.sizeMode === 'amount') ticket.setAmountText(text);
        else ticket.setQtyText(text);
      },
      setPrice: (text: string) => {
        if (ticket.form.type === 'stop') ticket.setStopText(text);
        else ticket.setLimitText(text);
      },
      review: ticket.review,
      submit: ticket.submit,
      retry: ticket.retry,
      edit: ticket.backToEntry,
      viewPosition: () => {
        router.push('/portfolio');
      },
      setAlert: () => {
        router.push(`/alerts?new=${symbol}` as Route);
      },
      done: () => {
        ticket.reset();
        if (mode !== 'panel') replaceSearchParam('trade', null);
      },
    },
  };
}

export type OrderPanelModel = ReturnType<typeof useOrderPanel>;
