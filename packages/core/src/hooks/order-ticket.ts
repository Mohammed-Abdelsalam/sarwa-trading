import { useEffect, useState } from 'react';

import { type Quote, toDomain } from '@sarwa/contracts';
import {
  cents,
  changeBps,
  collarRange,
  estimateOrder,
  isMarketable,
  needsLargeOrderConfirm,
  parseTicks,
  type ExecutionRules,
  type MarketSession,
  type OrderContext,
  type OrderType,
  POLICY,
  ratioBps,
  type Side,
  type TimeInForce,
  validateOrder,
} from '@sarwa/domain';

import { useSarwa } from '../provider';
import {
  buildDraft,
  centsToText,
  fieldErrors,
  initialTicketForm,
  type QuickAmount,
  quickAmounts,
  type SizeMode,
  type TicketBlock,
  type TicketForm,
  type TicketStep,
} from '../ticket';
import { orderFill, spreadBps, toTradeQuote } from '../trading';
import { useLiveStatus, useLiveSymbols, useMarketStatus, useQuote } from './live';
import { usePlaceOrder } from './orders';
import { usePortfolio } from './portfolio';
import { useIsHalted, useTradingStatus } from './trading-status';

const CLOCK_MS = 250;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}

interface Frozen {
  quote: Quote;
  at: number;
}

// The order ticket as a view model: both apps render it, neither re-implements a rule.
export function useOrderTicket({ symbol, initialSide }: { symbol: string; initialSide: Side }) {
  const { store } = useSarwa();
  useLiveSymbols([symbol]);
  const quote = useQuote(symbol);
  const status = useTradingStatus().data;
  const marketStatus = useMarketStatus();
  const live = useLiveStatus();
  const halted = useIsHalted(symbol);
  const portfolio = usePortfolio();
  const place = usePlaceOrder();
  const now = useNow(CLOCK_MS);

  const [form, setForm] = useState<TicketForm>(() => initialTicketForm(initialSide));
  const [rawStep, setStep] = useState<'entry' | 'review'>('entry');
  const [frozen, setFrozen] = useState<Frozen | null>(null);
  const step: TicketStep = rawStep === 'review' && place.status === 'done' ? 'result' : rawStep;
  const counting = step === 'review' && place.status !== 'sending';

  // When the reviewed price expires it is replaced by the latest one and the countdown restarts.
  useEffect(() => {
    if (!counting || !frozen) return;
    const timer = setTimeout(
      () => {
        setFrozen({ quote: store.getState().quotes[symbol] ?? frozen.quote, at: Date.now() });
      },
      Math.max(0, frozen.at + POLICY.quoteValidityMs - Date.now()),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [counting, frozen, store, symbol]);

  const liveQuote = quote ? toTradeQuote(quote) : null;
  const shownQuote = step !== 'entry' && frozen ? toTradeQuote(frozen.quote) : liveQuote;
  const sellable = portfolio.sellableMicros(symbol);
  const buyingPower = portfolio.buyingPowerCents ?? cents(0);
  const draft = buildDraft(form, sellable, liveQuote?.bidTicks ?? null);

  // Rules are checked against the live quote (what the server will see); the review shows the frozen one.
  const ctx: OrderContext | null =
    liveQuote && status
      ? {
          quote: liveQuote,
          session: toDomain<MarketSession>(status.session),
          rules: toDomain<ExecutionRules>(status.rules),
          tradingEnabled: status.tradingEnabled,
          marketPaused: marketStatus?.state === 'paused',
          halted,
          buyingPowerCents: buyingPower,
          sellableMicros: sellable,
          now,
        }
      : null;
  const issues = draft && ctx ? validateOrder(draft, ctx) : [];
  const estimate =
    draft && ctx && shownQuote ? estimateOrder(draft, { ...ctx, quote: shownQuote }) : null;
  const connectionLive = live === 'live' || live === 'paused';
  const blockReason: TicketBlock | null = !connectionLive
    ? { code: 'CONNECTION_NOT_LIVE' }
    : !status || portfolio.isLoading
      ? { code: 'STATUS_LOADING' }
      : (issues[0] ?? null);
  const equity = portfolio.summary?.equityCents ?? cents(0);
  const fill = place.order ? orderFill(place.order) : null;
  // The price hint follows the typed price even before a size is entered.
  const priceTicks =
    form.type === 'market'
      ? null
      : parseTicks(form.type === 'limit' ? form.limitText : form.stopText);
  const buyingPowerAfter = !estimate
    ? buyingPower
    : cents(
        form.side === 'buy'
          ? buyingPower - estimate.holdCents
          : buyingPower + estimate.notionalCents,
      );

  const edit = (patch: Partial<TicketForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };
  const editSize = (patch: Partial<TicketForm>) => {
    edit({ ...patch, sellAll: false });
  };

  return {
    form,
    step,
    quote,
    draft,
    estimate,
    issues,
    blockReason,
    fieldErrors: fieldErrors(issues),
    canReview: step === 'entry' && draft !== null && estimate !== null && blockReason === null,
    buyingPowerCents: buyingPower,
    buyingPowerAfterCents: buyingPowerAfter,
    equityShareBps: ratioBps(estimate?.notionalCents ?? 0, equity),
    collar: form.type !== 'market' && ctx ? collarRange(ctx.quote.lastTicks, ctx.rules) : null,
    spreadBps: liveQuote ? spreadBps(liveQuote) : null,
    distanceBps: priceTicks && liveQuote ? changeBps(liveQuote.lastTicks, priceTicks) : null,
    quoteValidityMs: POLICY.quoteValidityMs,
    sellableMicros: sellable,
    position: portfolio.position(symbol),
    quickAmounts: quickAmounts(form.side, buyingPower, sellable, liveQuote?.lastTicks ?? null),
    needsLargeConfirm: estimate !== null && needsLargeOrderConfirm(estimate.notionalCents, equity),
    restingLimit:
      draft?.limitTicks !== undefined &&
      shownQuote !== null &&
      !isMarketable(draft.side, draft.limitTicks, shownQuote),
    reviewedQuote: step === 'entry' ? null : (frozen?.quote ?? null),
    quoteMsLeft:
      counting && frozen
        ? Math.min(POLICY.quoteValidityMs, Math.max(0, frozen.at + POLICY.quoteValidityMs - now))
        : null,
    submitStatus: place.status,
    submitError: place.error,
    result: place.order && fill ? { order: place.order, ...fill } : null,

    setSide: (side: Side) => {
      editSize({ side });
    },
    setType: (type: OrderType) => {
      edit({ type });
    },
    setTif: (tif: TimeInForce) => {
      edit({ tif });
    },
    setSizeMode: (sizeMode: SizeMode) => {
      editSize({ sizeMode });
    },
    setAmountText: (amountText: string) => {
      editSize({ amountText });
    },
    setQtyText: (qtyText: string) => {
      editSize({ qtyText });
    },
    setLimitText: (limitText: string) => {
      edit({ limitText });
    },
    setStopText: (stopText: string) => {
      edit({ stopText });
    },
    chooseQuickAmount: (amount: QuickAmount) => {
      edit({
        sizeMode: 'amount',
        amountText: centsToText(amount.cents),
        sellAll: amount.key === 'max' && form.side === 'sell',
      });
    },
    review: () => {
      if (step !== 'entry' || !draft || !estimate || blockReason || !quote) return;
      setFrozen({ quote, at: Date.now() });
      setStep('review');
    },
    submit: () => {
      if (step !== 'review' || !draft || !frozen || blockReason) return;
      const reviewed = toTradeQuote(frozen.quote);
      place.submit({
        symbol,
        ...draft,
        quotedTicks: draft.side === 'buy' ? reviewed.askTicks : reviewed.bidTicks,
      });
    },
    retry: place.retry,
    backToEntry: () => {
      place.reset();
      setFrozen(null);
      setStep('entry');
    },
    reset: () => {
      place.reset();
      setFrozen(null);
      setStep('entry');
      setForm(initialTicketForm(initialSide));
    },
  };
}
