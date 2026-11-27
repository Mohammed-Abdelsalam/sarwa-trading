import { type Route } from 'next';
import { useRouter } from 'next/navigation';

import {
  type Ticket,
  ticketResultView,
  useOrderTicket,
  usePortfolio,
  useTradingStatus,
} from '@sarwa/core';
import { breakpoints } from '@sarwa/tokens';

import {
  isTyping,
  replaceSearchParam,
  useMediaQuery,
  useModKey,
  useSearchParam,
  useWindowKeyDown,
} from '../../lib/browser';
import { type Copy, useCopy } from '../../lib/i18n';
import { entryView, reviewView } from './ticket-copy';

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
  const opensAt = session?.session.opensAt ?? null;
  const position =
    order.filledMicros > 0 ? summary?.positions.find((p) => p.symbol === symbol) : undefined;
  return {
    ...ticketResultView(order, result, { symbol, opensAt }, copy),
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

// The ticket follows ?trade=buy|sell: the deep link opens it, B / S set it, closing clears it.
export function useOrderPanel(symbol: string) {
  const copy = useCopy();
  const { t, m } = copy;
  const router = useRouter();
  const trade = parseSide(useSearchParam('trade'));
  // CSS lays out the side panel and the trade bar; these only decide how the ticket behaves.
  const wide = useMediaQuery(`(min-width: ${String(breakpoints.xl)}px)`);
  const tablet = useMediaQuery(`(min-width: ${String(breakpoints.md)}px)`);
  const ticket = useOrderTicket({ symbol, initialSide: trade ?? 'buy' });
  const status = useTradingStatus().data;
  const { summary } = usePortfolio();
  const mod = useModKey();
  const overlayOpen = !wide && trade !== null;
  const open = wide || overlayOpen;

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
    overlay: tablet ? ('drawer' as const) : ('sheet' as const),
    overlayOpen,
    open,
    step: ticket.step,
    entry: entryView(ticket, symbol, status, copy),
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
        if (!wide) replaceSearchParam('trade', null);
      },
    },
  };
}

export type OrderPanelModel = ReturnType<typeof useOrderPanel>;
