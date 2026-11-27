import { DEFAULT_EXECUTION_RULES } from '@sarwa/domain';

import { auditChanges, auditPreview } from '../../src/admin/format';
import {
  configChanges,
  configToDraft,
  EMPTY_STOCK_DRAFT,
  isResetConfirmed,
  parseRulesDraft,
  rulesPatch,
  rulesToDraft,
  stockToDraft,
  togglePeriod,
  validateStockDraft,
} from '../../src/admin/forms';
import { makeAdminStock, makeConfig } from './fixtures';

describe('validateStockDraft', () => {
  it('reports every invalid field with a code', () => {
    const { errors, create } = validateStockDraft(
      { ...EMPTY_STOCK_DRAFT, symbol: 'aapl', basePrice: '-12', volatility: '9', peRatio: 'x' },
      { existing: ['AAPL'] },
    );

    expect(create).toBeNull();
    expect(errors).toEqual({
      symbol: 'symbolTaken',
      name: 'required',
      sector: 'required',
      exchange: 'required',
      basePrice: 'positive',
      volatility: 'range',
      peRatio: 'positive',
    });
  });

  it('flags malformed symbols and numbers', () => {
    const { errors } = validateStockDraft({
      ...EMPTY_STOCK_DRAFT,
      symbol: '12',
      basePrice: 'abc',
      volatility: '',
    });
    expect(errors).toMatchObject({
      symbol: 'symbolFormat',
      basePrice: 'invalid',
      volatility: 'required',
    });
    expect(validateStockDraft({ ...EMPTY_STOCK_DRAFT }).errors).toMatchObject({
      symbol: 'required',
      basePrice: 'required',
    });
    expect(validateStockDraft({ ...EMPTY_STOCK_DRAFT, volatility: 'x' }).errors.volatility).toBe(
      'invalid',
    );
  });

  it('builds create and update bodies from a valid draft', () => {
    const draft = { ...stockToDraft(makeAdminStock({ peRatio: null })), symbol: 'nvda' };

    const { errors, create, update } = validateStockDraft(draft);

    expect(errors).toEqual({});
    expect(create).toMatchObject({
      symbol: 'NVDA',
      basePrice: 230,
      volatility: 1.2,
      peRatio: null,
    });
    expect(update).not.toHaveProperty('symbol');
  });

  it('ignores the symbol while editing', () => {
    const draft = stockToDraft(makeAdminStock());
    expect(validateStockDraft(draft, { existing: ['AAPL'], editing: true }).errors).toEqual({});
  });
});

describe('execution rules form', () => {
  it('round-trips the wire rules through operator units', () => {
    const draft = rulesToDraft(DEFAULT_EXECUTION_RULES);

    expect(draft).toMatchObject({
      spreadBps: '0.02',
      collarBps: '10',
      staleQuoteMs: '5',
      maxNotionalCents: '250000',
      minNotionalCents: '1',
    });
    expect(parseRulesDraft(draft)).toEqual({ rules: DEFAULT_EXECUTION_RULES, errors: {} });
  });

  it('rejects unparseable, out-of-range and inverted values', () => {
    const draft = rulesToDraft(DEFAULT_EXECUTION_RULES);

    expect(parseRulesDraft({ ...draft, spreadBps: 'abc', staleQuoteMs: '' }).errors).toEqual({
      spreadBps: 'invalid',
      staleQuoteMs: 'required',
    });
    expect(parseRulesDraft({ ...draft, collarBps: '90' }).errors).toEqual({ collarBps: 'range' });
    expect(parseRulesDraft({ ...draft, spreadBps: '-0.02' }).errors).toEqual({
      spreadBps: 'invalid',
    });
    expect(parseRulesDraft({ ...draft, minNotionalCents: '300000' }).errors).toEqual({
      minNotionalCents: 'range',
    });
  });

  it('patches only what changed', () => {
    const next = { ...DEFAULT_EXECUTION_RULES, spreadBps: 4 };
    expect(rulesPatch(DEFAULT_EXECUTION_RULES, next, ['spreadBps'])).toEqual({ spreadBps: 4 });
    expect(
      rulesPatch({ ...DEFAULT_EXECUTION_RULES, collarBps: 900 }, next, [
        'spreadBps',
        'staleQuoteMs',
      ]),
    ).toEqual({ spreadBps: 4 });
  });
});

describe('config draft', () => {
  const saved = makeConfig({ banner: { message: 'Hi', tone: 'info' } });

  it('counts each change and builds the patch', () => {
    const draft = {
      ...configToDraft(saved),
      maintenanceMode: true,
      bannerMessage: '  ',
      enabledPeriods: togglePeriod(togglePeriod(saved.enabledPeriods, '1D'), 'ALL'),
    };

    expect(configChanges(saved, draft)).toEqual({
      count: 4,
      patch: { maintenanceMode: true, banner: null, enabledPeriods: ['1W', '1M', '1Y'] },
    });
    expect(configChanges(saved, configToDraft(saved))).toEqual({ count: 0, patch: {} });
  });

  it('only diffs the fields that were edited', () => {
    const newer = makeConfig({ banner: { message: 'Close at 1pm', tone: 'warning' } });

    expect(configChanges(newer, { maintenanceMode: true })).toEqual({
      count: 1,
      patch: { maintenanceMode: true },
    });
    expect(configChanges(newer, { bannerTone: 'info' })).toEqual({
      count: 1,
      patch: { banner: { message: 'Close at 1pm', tone: 'info' } },
    });
  });

  it('keeps at least one period and restores the canonical order', () => {
    expect(togglePeriod(['1D'], '1D')).toEqual(['1D']);
    expect(togglePeriod(['ALL'], '1D')).toEqual(['1D', 'ALL']);
    expect(configToDraft(makeConfig()).bannerTone).toBe('info');
  });
});

describe('reset confirmation', () => {
  it('needs the exact phrase', () => {
    expect(isResetConfirmed('ACC-00AA11', 'RESET ACC-00AA11')).toBe(true);
    expect(isResetConfirmed('ACC-00AA11', 'reset ACC-00AA11')).toBe(false);
    expect(isResetConfirmed('ACC-00AA11', 'RESET ACC-00AA11 ')).toBe(false);
  });
});

describe('admin formatting', () => {
  it('turns audit payloads into before/after rows', () => {
    expect(
      auditChanges({ before: { state: 'running', volatility: 1 }, after: { state: 'paused' } }),
    ).toEqual([
      { key: 'state', before: 'running', after: 'paused' },
      { key: 'volatility', before: '1', after: null },
    ]);
    expect(auditChanges({ dropped: 3 })).toEqual([{ key: 'dropped', before: null, after: '3' }]);
    expect(auditChanges({ before: null, after: [1] })).toEqual([]);
    expect(auditPreview({})).toBe('—');
    expect(auditPreview({ a: 1 })).toBe('{"a":1}');
  });
});
