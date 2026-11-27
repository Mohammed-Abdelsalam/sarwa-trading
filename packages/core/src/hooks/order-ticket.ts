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
  type TradeQuote,
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
import { useNow } from './time';
import { useIsHalted, useTradingStatus } from './trading-status';

const CLOCK_MS = 250;

interface Frozen {
  quote: Quote;
  at: number;
}

// What the trader typed, edited field by field; a size edit always undoes "sell all".
export function useTicketForm(initialSide: Side) {
  const [form, setForm] = useState<TicketForm>(() => initialTicketForm(initialSide));
  const edit = (patch: Partial<TicketForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };
  const editSize = (patch: Partial<TicketForm>) => {
    edit({ ...patch, sellAll: false });
  };
  return {
    form,
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
    reset: () => {
      setForm(initialTicketForm(initialSide));
    },
  };
}

// The quote a review shows; while `counting`, it is replaced by the latest one each time it expires.
export function useFrozenQuote(symbol: string, counting: boolean) {
  const { store } = useSarwa();
  const [frozen, setFrozen] = useState<Frozen | null>(null);

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

  return {
    frozen,
    freeze: (quote: Quote) => {
      setFrozen({ quote, at: Date.now() });
    },
    clear: () => {
      setFrozen(null);
    },
  };
}

// The draft checked against every rule with the live quote (what the server will see), and estimated
// with `shownQuote` (the frozen one during review).
export function useTicketValidation(
  symbol: string,
  form: TicketForm,
  shownQuote: TradeQuote | null,
) {
  useLiveSymbols([symbol]);
  const quote = useQuote(symbol);
  const status = useTradingStatus().data;
  const marketStatus = useMarketStatus();
  const live = useLiveStatus();
  const halted = useIsHalted(symbol);
  const portfolio = usePortfolio();
  const now = useNow(CLOCK_MS);

  const liveQuote = quote ? toTradeQuote(quote) : null;
  const sellable = portfolio.sellableMicros(symbol);
  const buyingPower = portfolio.buyingPowerCents ?? cents(0);
  const draft = buildDraft(form, sellable, liveQuote?.bidTicks ?? null);
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
  const priced = shownQuote ?? liveQuote;
  const estimate = draft && ctx && priced ? estimateOrder(draft, { ...ctx, quote: priced }) : null;
  const connectionLive = live === 'live' || live === 'paused';
  const blockReason: TicketBlock | null = !connectionLive
    ? { code: 'CONNECTION_NOT_LIVE' }
    : !status || portfolio.isLoading
      ? { code: 'STATUS_LOADING' }
      : (issues[0] ?? null);

  return {
    quote,
    liveQuote,
    portfolio,
    now,
    sellable,
    buyingPower,
    draft,
    ctx,
    issues,
    estimate,
    blockReason,
  };
}

// The order ticket as a view model: both apps render it, neither re-implements a rule.
export function useOrderTicket({ symbol, initialSide }: { symbol: string; initialSide: Side }) {
  const place = usePlaceOrder();
  const ticketForm = useTicketForm(initialSide);
  const { form } = ticketForm;
  const [rawStep, setStep] = useState<'entry' | 'review'>('entry');
  const step: TicketStep = rawStep === 'review' && place.status === 'done' ? 'result' : rawStep;
  const counting = step === 'review' && place.status !== 'sending';
  const { frozen, freeze, clear } = useFrozenQuote(symbol, counting);
  const reviewed = step !== 'entry' && frozen ? toTradeQuote(frozen.quote) : null;
  const rules = useTicketValidation(symbol, form, reviewed);
  const { quote, liveQuote, portfolio, now, sellable, buyingPower, draft, ctx, estimate } = rules;
  const { issues, blockReason } = rules;
  const shownQuote = reviewed ?? liveQuote;

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

    setSide: ticketForm.setSide,
    setType: ticketForm.setType,
    setTif: ticketForm.setTif,
    setSizeMode: ticketForm.setSizeMode,
    setAmountText: ticketForm.setAmountText,
    setQtyText: ticketForm.setQtyText,
    setLimitText: ticketForm.setLimitText,
    setStopText: ticketForm.setStopText,
    chooseQuickAmount: ticketForm.chooseQuickAmount,
    review: () => {
      if (step !== 'entry' || !draft || !estimate || blockReason || !quote) return;
      freeze(quote);
      setStep('review');
    },
    submit: () => {
      if (step !== 'review' || !draft || !frozen || blockReason) return;
      const quoted = toTradeQuote(frozen.quote);
      place.submit({
        symbol,
        ...draft,
        quotedTicks: draft.side === 'buy' ? quoted.askTicks : quoted.bidTicks,
      });
    },
    retry: place.retry,
    backToEntry: () => {
      place.reset();
      clear();
      setStep('entry');
    },
    reset: () => {
      place.reset();
      clear();
      setStep('entry');
      ticketForm.reset();
    },
  };
}
