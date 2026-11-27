import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';

import { type Order } from '@sarwa/contracts';
import {
  applyKeypadKey,
  AuthIntentSchema,
  POLICY,
  bps,
  type KeypadKey,
  marketPill,
  micros,
  type QuickAmount,
  type SizeMode,
  type TicketForm,
  ticketEntryView,
  ticketResultView,
  ticketReviewView,
  useHalt,
  useLiveStatus,
  useOrderTicket,
  usePortfolio,
  useGate,
  useRequireAuth,
  useSession,
  useStockIndex,
  useTradingStatus,
} from '@sarwa/core';

import { usePlainControls } from '../../lib/a11y';
import { useCopy } from '../../lib/i18n';
import { goBack } from '../../lib/navigation';
import {
  amountDisplay,
  blockLabel,
  entryRows,
  gates,
  marketClosedGate,
  quickChips,
  quoteLine,
  upfrontBlocks,
} from './ticket-entry-model';
import { reviewRows, reviewSubline } from './ticket-review-model';

type Side = Order['side'];
type Focus = 'size' | 'price';

// The ticket a guest filled in before signing in, from the route; anything malformed is dropped.
export function parseTicketForm(
  symbol: string,
  side: Side,
  param: string | undefined,
): TicketForm | undefined {
  if (!param) return undefined;
  try {
    const parsed = AuthIntentSchema.safeParse({
      kind: 'order',
      symbol,
      side,
      form: JSON.parse(param) as unknown,
    });
    return parsed.success && parsed.data.kind === 'order' ? parsed.data.form : undefined;
  } catch {
    return undefined;
  }
}

const MONEY_DECIMALS = 2;
const SHARE_DECIMALS = 6;

export function useOrderTicketScreen(symbol: string, initialSide: Side, initialForm?: TicketForm) {
  const copy = useCopy();
  const { t, f } = copy;
  const ticket = useOrderTicket({ symbol, initialSide, initialForm });
  const { run } = useRequireAuth();
  const gate = useGate();
  const { isGuest } = useSession();
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
  const shared = ticketEntryView(ticket, { symbol, status }, copy);
  const review = ticketReviewView(ticket, symbol, copy);
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

  // What the guest typed waits in the intent; replacing the ticket means the resumed order opens the only one.
  const signUpFirst = (path: '/sign-up' | '/sign-in') => () => {
    run(ticket.intent, () => undefined);
    gate.close();
    router.replace(path);
  };

  return {
    step: ticket.step,
    symbol,
    guest: isGuest
      ? {
          symbol,
          side: form.side,
          startingCash: f.money(POLICY.startingCashCents, { whole: true }),
          onCreateAccount: signUpFirst('/sign-up'),
          onSignIn: signUpFirst('/sign-in'),
        }
      : null,
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
      amount: amountDisplay(ticket, shared.size, copy),
      sizeFocused: focus === 'size',
      sizeError: shared.size.error,
      chips: quickChips(ticket, copy),
      price: shared.price && {
        ...shared.price,
        value: f.localDigits(shared.price.value),
        focused: focus === 'price',
      },
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
      headline: review?.headline ?? '',
      subline: reviewSubline(ticket, copy),
      rows: review ? reviewRows(ticket, review, copy) : [],
      countdown: review?.countdown
        ? { label: review.countdown.label, fraction: review.countdown.fraction }
        : null,
      note: t.paper.orderNote,
      resting: review?.resting ?? null,
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
            ...ticketResultView(
              order,
              ticket.result,
              { symbol, opensAt: status?.session.opensAt ?? null },
              copy,
            ),
            status: order.status,
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
      close: goBack,
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
