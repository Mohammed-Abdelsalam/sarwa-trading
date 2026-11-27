import {
  type AdminStock,
  type AppConfig,
  type BannerTone,
  type CreateStock,
  type Exchange,
  ExecutionRulesSchema,
  type ExecutionRulesWire,
  LoginRequestSchema,
  type Period,
  PERIODS,
  resetConfirmation,
  type Sector,
  STOCK_VOLATILITY,
  SymbolSchema,
  type UpdateAppConfig,
  type UpdateStock,
} from '@sarwa/contracts';
import { parseCents } from '@sarwa/domain';

import { type I18n } from '../hooks/i18n';

export type FieldError =
  'required' | 'invalid' | 'symbolFormat' | 'symbolTaken' | 'positive' | 'range';

export interface StockDraft {
  symbol: string;
  name: string;
  sector: Sector | '';
  exchange: Exchange | '';
  basePrice: string;
  volatility: string;
  peRatio: string;
  isEnabled: boolean;
}

export type StockErrors = Partial<Record<keyof StockDraft, FieldError>>;

export const EMPTY_STOCK_DRAFT: StockDraft = {
  symbol: '',
  name: '',
  sector: '',
  exchange: '',
  basePrice: '',
  volatility: '1',
  peRatio: '',
  isEnabled: true,
};

export function stockToDraft(stock: AdminStock): StockDraft {
  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    exchange: stock.exchange,
    basePrice: String(stock.basePrice),
    volatility: String(stock.volatility),
    peRatio: stock.peRatio === null ? '' : String(stock.peRatio),
    isEnabled: stock.isEnabled,
  };
}

const toNumber = (text: string): number | null => {
  const trimmed = text.trim();
  return trimmed === '' || !Number.isFinite(Number(trimmed)) ? null : Number(trimmed);
};

export function validateStockDraft(
  draft: StockDraft,
  { existing = [], editing = false }: { existing?: readonly string[]; editing?: boolean } = {},
): { errors: StockErrors; create: CreateStock | null; update: UpdateStock | null } {
  const errors: StockErrors = {};
  const symbol = draft.symbol.trim().toUpperCase();
  if (!editing) {
    if (!symbol) errors.symbol = 'required';
    else if (!SymbolSchema.safeParse(symbol).success) errors.symbol = 'symbolFormat';
    else if (existing.includes(symbol)) errors.symbol = 'symbolTaken';
  }
  if (!draft.name.trim()) errors.name = 'required';
  if (!draft.sector) errors.sector = 'required';
  if (!draft.exchange) errors.exchange = 'required';
  const basePrice = toNumber(draft.basePrice);
  if (draft.basePrice.trim() === '') errors.basePrice = 'required';
  else if (basePrice === null) errors.basePrice = 'invalid';
  else if (basePrice <= 0) errors.basePrice = 'positive';
  const volatility = toNumber(draft.volatility);
  if (volatility === null) errors.volatility = draft.volatility.trim() ? 'invalid' : 'required';
  else if (volatility < STOCK_VOLATILITY.min || volatility > STOCK_VOLATILITY.max)
    errors.volatility = 'range';
  const peRatio = draft.peRatio.trim() === '' ? null : toNumber(draft.peRatio);
  if (draft.peRatio.trim() !== '' && (peRatio === null || peRatio <= 0))
    errors.peRatio = 'positive';

  if (
    Object.keys(errors).length > 0 ||
    !draft.sector ||
    !draft.exchange ||
    basePrice === null ||
    volatility === null
  ) {
    return { errors, create: null, update: null };
  }
  const fields = {
    name: draft.name.trim(),
    sector: draft.sector,
    exchange: draft.exchange,
    basePrice,
    volatility,
    peRatio,
    isEnabled: draft.isEnabled,
  };
  return { errors, create: { symbol, ...fields }, update: fields };
}

type NumericRule = Exclude<keyof ExecutionRulesWire, 'queueWhenClosed'>;
export type RuleUnit = 'percent' | 'seconds' | 'dollars';

export const RULE_UNITS: Record<NumericRule, RuleUnit> = {
  spreadBps: 'percent',
  maxSlippageBps: 'percent',
  collarBps: 'percent',
  staleQuoteMs: 'seconds',
  minNotionalCents: 'dollars',
  maxNotionalCents: 'dollars',
  closedMarketBufferBps: 'percent',
};

export const NUMERIC_RULES = Object.keys(RULE_UNITS) as NumericRule[];

export type RulesDraft = Record<NumericRule, string> & { queueWhenClosed: boolean };
export type RulesErrors = Partial<Record<keyof ExecutionRulesWire, FieldError>>;

const MS_PER_SECOND = 1_000;

// Operators type %, seconds and dollars; the wire carries bps, ms and cents.
export function rulesToDraft(rules: ExecutionRulesWire): RulesDraft {
  const text = (key: NumericRule) =>
    RULE_UNITS[key] === 'seconds'
      ? String(rules[key] / MS_PER_SECOND)
      : (rules[key] / 100).toFixed(2).replace(/\.?0+$/, '');
  return {
    spreadBps: text('spreadBps'),
    maxSlippageBps: text('maxSlippageBps'),
    collarBps: text('collarBps'),
    staleQuoteMs: text('staleQuoteMs'),
    minNotionalCents: text('minNotionalCents'),
    maxNotionalCents: text('maxNotionalCents'),
    closedMarketBufferBps: text('closedMarketBufferBps'),
    queueWhenClosed: rules.queueWhenClosed,
  };
}

function parseRule(unit: RuleUnit, text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, '');
  if (unit !== 'seconds') return parseCents(cleaned);
  if (!/^\d+(\.\d{0,3})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * MS_PER_SECOND);
}

export function parseRulesDraft(draft: RulesDraft): {
  rules: ExecutionRulesWire | null;
  errors: RulesErrors;
} {
  const errors: RulesErrors = {};
  const parsed: Partial<ExecutionRulesWire> = { queueWhenClosed: draft.queueWhenClosed };
  for (const key of NUMERIC_RULES) {
    const value = parseRule(RULE_UNITS[key], draft[key]);
    if (value === null) errors[key] = draft[key].trim() ? 'invalid' : 'required';
    else parsed[key] = value;
  }
  if (Object.keys(errors).length > 0) return { rules: null, errors };

  const result = ExecutionRulesSchema.safeParse(parsed);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof ExecutionRulesWire | undefined;
      if (key) errors[key] = 'range';
    }
    return { rules: null, errors };
  }
  if (result.data.minNotionalCents >= result.data.maxNotionalCents) {
    return { rules: null, errors: { minNotionalCents: 'range' } };
  }
  return { rules: result.data, errors };
}

export function rulesPatch(
  saved: ExecutionRulesWire,
  next: ExecutionRulesWire,
): Partial<ExecutionRulesWire> {
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => saved[key as keyof ExecutionRulesWire] !== value),
  );
}

export interface ConfigDraft {
  maintenanceMode: boolean;
  bannerMessage: string;
  bannerTone: BannerTone;
  enabledPeriods: Period[];
}

export function configToDraft(config: AppConfig): ConfigDraft {
  return {
    maintenanceMode: config.maintenanceMode,
    bannerMessage: config.banner?.message ?? '',
    bannerTone: config.banner?.tone ?? 'info',
    enabledPeriods: [...config.enabledPeriods],
  };
}

// The last enabled period can't be switched off: clients always need one chart range.
export function togglePeriod(periods: readonly Period[], period: Period): Period[] {
  if (periods.includes(period)) {
    return periods.length > 1 ? periods.filter((p) => p !== period) : [...periods];
  }
  return PERIODS.filter((p) => p === period || periods.includes(p));
}

export function configChanges(
  saved: AppConfig,
  draft: ConfigDraft,
): { patch: UpdateAppConfig; count: number } {
  const patch: UpdateAppConfig = {};
  let count = 0;
  if (draft.maintenanceMode !== saved.maintenanceMode) {
    patch.maintenanceMode = draft.maintenanceMode;
    count += 1;
  }
  const message = draft.bannerMessage.trim();
  const banner = message ? { message, tone: draft.bannerTone } : null;
  if (banner?.message !== saved.banner?.message || banner?.tone !== saved.banner?.tone) {
    patch.banner = banner;
    count += 1;
  }
  const toggled = PERIODS.filter(
    (p) => draft.enabledPeriods.includes(p) !== saved.enabledPeriods.includes(p),
  ).length;
  if (toggled > 0) {
    patch.enabledPeriods = PERIODS.filter((p) => draft.enabledPeriods.includes(p));
    count += toggled;
  }
  return { patch, count };
}

// Exact match, case and spacing included: the reset can't be undone.
export function isResetConfirmed(handle: string, typed: string): boolean {
  return typed === resetConfirmation(handle);
}

export const PASSWORD_MIN_LENGTH = LoginRequestSchema.shape.password.minLength ?? 0;
export const SYMBOL_MAX_LENGTH = 10;
export const REMEMBER_DAYS = 7;
export const CONFIG_APPLY_SECONDS = 5;

export function stockErrorText(code: FieldError, { t, f }: Pick<I18n, 't' | 'f'>): string {
  const errors = t.admin.stocks.errors;
  switch (code) {
    case 'symbolFormat':
      return errors.symbolFormat({ min: f.number(1), max: f.number(SYMBOL_MAX_LENGTH) });
    case 'positive':
      return errors.positive({ n: f.number(0) });
    case 'range':
      return errors.range(volatilityRange({ f }));
    case 'required':
    case 'invalid':
    case 'symbolTaken':
      return errors[code];
  }
}

export function volatilityRange({ f }: Pick<I18n, 'f'>): { min: string; max: string } {
  return { min: f.multiplier(STOCK_VOLATILITY.min), max: f.multiplier(STOCK_VOLATILITY.max) };
}
