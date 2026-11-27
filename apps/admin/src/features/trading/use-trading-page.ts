import { useState } from 'react';

import { CreateHaltSchema, type HaltDuration } from '@sarwa/contracts';
import { useStocks, type SessionMode } from '@sarwa/core';
import {
  parseRulesDraft,
  type RulesDraft,
  rulesPatch,
  rulesToDraft,
  useAdminSession,
  useAdminStocks,
  useAdminTrading,
  useCreateHalt,
  useHaltImpact,
  useResumeHalt,
  useUpdateStock,
  useUpdateTrading,
  marketClock,
} from '@sarwa/core/admin';

import { shortActor } from '../overview/use-overview-page';

function useHaltDialog() {
  const stocks = useStocks();
  const create = useCreateHalt();
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState<HaltDuration>('15m');
  const [notify, setNotify] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const impact = useHaltImpact(open && symbol ? symbol : null);
  const body = { symbol, message, duration, notify };
  const parsed = CreateHaltSchema.safeParse(body);
  const messageError = submitted && !message.trim() ? ('required' as const) : undefined;

  return {
    open,
    symbol,
    message,
    duration,
    notify,
    messageError,
    stocks: stocks.data ?? [],
    impact: impact.data?.symbol === symbol ? impact.data : undefined,
    impactLoading: impact.isFetching,
    isSaving: create.isPending,
    failed: create.isError,
    actions: {
      open: (initial?: string) => {
        create.reset();
        setSymbol(initial ?? stocks.data?.[0]?.symbol ?? '');
        setMessage('');
        setDuration('15m');
        setNotify(true);
        setSubmitted(false);
        setOpen(true);
      },
      close: () => {
        setOpen(false);
      },
      setSymbol,
      setMessage,
      setDuration,
      setNotify,
      submit: () => {
        setSubmitted(true);
        if (!parsed.success) return;
        create.mutate(parsed.data, {
          onSuccess: () => {
            setOpen(false);
          },
        });
      },
    },
  };
}

function useRulesForm(saved: Parameters<typeof rulesToDraft>[0] | undefined) {
  const update = useUpdateTrading();
  const [draft, setDraft] = useState<RulesDraft | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const current = draft ?? (saved ? rulesToDraft(saved) : null);
  const parsed = current ? parseRulesDraft(current) : null;
  const patch = saved && parsed?.rules ? rulesPatch(saved, parsed.rules) : {};

  return {
    draft: current,
    errors: submitted ? (parsed?.errors ?? {}) : {},
    dirty: draft !== null && (!parsed?.rules || Object.keys(patch).length > 0),
    isSaving: update.isPending,
    failed: update.isError && update.variables.rules !== undefined,
    actions: {
      set: <K extends keyof RulesDraft>(key: K, value: RulesDraft[K]) => {
        if (current) setDraft({ ...current, [key]: value });
      },
      discard: () => {
        setDraft(null);
        setSubmitted(false);
      },
      save: () => {
        setSubmitted(true);
        if (!parsed?.rules) return;
        if (Object.keys(patch).length === 0) {
          setDraft(null);
          return;
        }
        update.mutate(
          { rules: patch },
          {
            onSuccess: () => {
              setDraft(null);
              setSubmitted(false);
            },
          },
        );
      },
    },
  };
}

export function useTradingPage() {
  const { canEdit } = useAdminSession();
  const trading = useAdminTrading();
  const update = useUpdateTrading();
  const resume = useResumeHalt();
  const adminStocks = useAdminStocks();
  const enableStock = useUpdateStock();
  const halt = useHaltDialog();
  const rules = useRulesForm(trading.data?.rules);
  const data = trading.data;
  const today = data ? marketClock(data.updatedAt).date : '';
  const lastTrip = data?.tripsToday.at(-1);

  return {
    canEdit,
    trading: data,
    isLoading: trading.isPending,
    isError: trading.isError,
    isUpdating: update.isPending,
    failed: update.isError || resume.isError || enableStock.isError,
    changedBy: data?.changedBy ? shortActor(data.changedBy) : null,
    lastTrip,
    disabledStocks: (adminStocks.data ?? []).filter((stock) => !stock.isEnabled),
    resuming: resume.isPending ? resume.variables : null,
    sectorOf: (symbol: string) =>
      halt.stocks.find((stock) => stock.symbol === symbol)?.sector ?? ('tech' as const),
    calendar: (data?.upcoming ?? []).map((day) => ({ ...day, isToday: day.date === today })),
    halt,
    rules,
    actions: {
      retry: () => void trading.refetch(),
      setTradingEnabled: (tradingEnabled: boolean) => {
        update.mutate({ tradingEnabled });
      },
      setCircuitBreaker: (enabled: boolean) => {
        update.mutate({ circuitBreaker: { enabled } });
      },
      setSessionMode: (sessionMode: SessionMode) => {
        update.mutate({ sessionMode });
      },
      resume: (symbol: string) => {
        resume.mutate(symbol);
      },
      enableStock: (symbol: string) => {
        enableStock.mutate({ symbol, patch: { isEnabled: true } });
      },
    },
  };
}

export type TradingPageModel = ReturnType<typeof useTradingPage>;
export type HaltDialogModel = TradingPageModel['halt'];
export type RulesFormModel = TradingPageModel['rules'];
