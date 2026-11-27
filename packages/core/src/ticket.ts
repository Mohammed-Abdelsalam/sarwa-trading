import {
  cents,
  type Cents,
  centsToDollars,
  dollarsToCents,
  marketValueCents,
  micros,
  type Micros,
  type OrderDraft,
  type OrderSize,
  type OrderType,
  parseCents,
  parseMicros,
  parseTicks,
  type Rejection,
  type Side,
  type Ticks,
  type TimeInForce,
} from '@sarwa/domain';
import { type ClientBlock } from '@sarwa/i18n';

export type SizeMode = 'amount' | 'shares';
export type TicketStep = 'entry' | 'review' | 'result';
export type TicketField = 'size' | 'limit' | 'stop';
// STATUS_LOADING holds the ticket until the trading status and the books arrive, so nothing looks tradable (or unaffordable) early.
export type TicketBlock = Rejection | ClientBlock;
export type KeypadKey =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'backspace';

export interface TicketForm {
  side: Side;
  type: OrderType;
  tif: TimeInForce;
  sizeMode: SizeMode;
  // Exactly as typed; parsed into integer units only when the draft is built.
  amountText: string;
  qtyText: string;
  limitText: string;
  stopText: string;
  sellAll: boolean;
}

export interface QuickAmount {
  key: '100' | '500' | '1000' | 'max';
  cents: Cents;
}

// A sell that would leave less than $1 of the position (at the bid) closes it, so no dust is left.
const SELL_ALL_DUST_CENTS = 100;
const QUICK_AMOUNTS = [
  { key: '100', cents: dollarsToCents(100) },
  { key: '500', cents: dollarsToCents(500) },
  { key: '1000', cents: dollarsToCents(1_000) },
] as const;

export function initialTicketForm(side: Side): TicketForm {
  return {
    side,
    type: 'market',
    tif: 'day',
    sizeMode: 'amount',
    amountText: '',
    qtyText: '',
    limitText: '',
    stopText: '',
    sellAll: false,
  };
}

export function applyKeypadKey(text: string, key: KeypadKey, decimals: number): string {
  if (key === 'backspace') return text.slice(0, -1);
  if (key === '.') {
    if (decimals === 0 || text.includes('.')) return text;
    return text === '' ? '0.' : `${text}.`;
  }
  const [, fraction] = text.split('.');
  if (fraction !== undefined && fraction.length >= decimals) return text;
  return text === '0' ? key : `${text}${key}`;
}

export function centsToText(cents: Cents): string {
  return String(centsToDollars(cents));
}

function positive<Unit extends number>(value: Unit | null): Unit | null {
  return value !== null && value > 0 ? value : null;
}

function covers(size: OrderSize, sellable: Micros, bidTicks: Ticks | null): boolean {
  if (size.kind === 'all') return true;
  if (size.kind === 'shares' && size.micros >= sellable) return true;
  if (bidTicks === null) return false;
  const left =
    size.kind === 'shares'
      ? marketValueCents(micros(sellable - size.micros), bidTicks)
      : marketValueCents(sellable, bidTicks) - size.cents;
  return left < SELL_ALL_DUST_CENTS;
}

// The typed form as a domain draft, or null while a required field is still empty or invalid.
export function buildDraft(
  form: TicketForm,
  sellable: Micros,
  bidTicks: Ticks | null,
): OrderDraft | null {
  const limitTicks = form.type === 'limit' ? positive(parseTicks(form.limitText)) : null;
  const stopTicks = form.type === 'stop' ? positive(parseTicks(form.stopText)) : null;
  if (form.type === 'limit' && limitTicks === null) return null;
  if (form.type === 'stop' && stopTicks === null) return null;

  const selling = form.side === 'sell' && sellable > 0;
  let size: OrderSize | null = null;
  if (selling && form.sellAll) size = { kind: 'all' };
  else if (form.sizeMode === 'amount') {
    const amount = positive(parseCents(form.amountText));
    if (amount !== null) size = { kind: 'amount', cents: amount };
  } else {
    const qty = positive(parseMicros(form.qtyText));
    if (qty !== null) size = { kind: 'shares', micros: qty };
  }
  if (!size) return null;
  if (selling && covers(size, sellable, bidTicks)) size = { kind: 'all' };

  return {
    side: form.side,
    type: form.type,
    tif: form.type === 'market' ? 'day' : form.tif,
    size,
    ...(limitTicks !== null && { limitTicks }),
    ...(stopTicks !== null && { stopTicks }),
  };
}

export function fieldErrors(issues: readonly Rejection[]): Partial<Record<TicketField, Rejection>> {
  const errors: Partial<Record<TicketField, Rejection>> = {};
  for (const issue of issues) if ('field' in issue) errors[issue.field] ??= issue;
  return errors;
}

// Max is the buying power for a buy and the sellable position's value for a sell.
export function quickAmounts(
  side: Side,
  buyingPowerCents: Cents,
  sellable: Micros,
  lastTicks: Ticks | null,
): QuickAmount[] {
  const max =
    side === 'buy'
      ? cents(Math.max(0, buyingPowerCents))
      : lastTicks === null
        ? cents(0)
        : marketValueCents(sellable, lastTicks);
  return [...QUICK_AMOUNTS, { key: 'max', cents: max }];
}
