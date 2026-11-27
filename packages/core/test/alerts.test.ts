import { createFormatter, getMessages } from '@sarwa/i18n';

import { alertDetail, alertRequest, alertState, alertTargetHint } from '../src/alerts';
import { makeAlert } from './trading-fixtures';
import { makeQuote } from './utils';

const copy = { t: getMessages('en'), f: createFormatter({ locale: 'en' }) };
const form = {
  symbol: 'AAPL',
  condition: 'price_above' as const,
  target: '250',
  repeat: 'once' as const,
};

describe('alertState', () => {
  it('is paused when disabled, triggered once fired and disarmed, active otherwise', () => {
    expect(alertState(makeAlert({ enabled: false }))).toBe('paused');
    expect(alertState(makeAlert({ armed: false, lastFiredAt: 5 }))).toBe('triggered');
    expect(alertState(makeAlert())).toBe('active');
  });
});

describe('alertDetail', () => {
  it('says how far the market is from a price alert, and the day move for a move alert', () => {
    const quote = makeQuote({ price: 200, prevClose: 190 });

    expect(alertDetail(makeAlert(), quote, copy)).toBe('Now $200.00 · 25.00% away');
    expect(
      alertDetail(makeAlert({ condition: 'move_today', thresholdTicks: null }), quote, copy),
    ).toBe('Today +5.26%');
    expect(alertDetail(makeAlert(), undefined, copy)).toBe('');
  });
});

describe('alertRequest', () => {
  it('turns typed text into the request, or null when it is not a usable number', () => {
    expect(alertRequest(form)).toEqual({ ...form, target: undefined, thresholdTicks: 2_500_000 });
    expect(alertRequest({ ...form, condition: 'move_today', target: '-5' })).toMatchObject({
      thresholdBps: -500,
    });
    expect(alertRequest({ ...form, target: '0' })).toBeNull();
    expect(alertRequest({ ...form, target: 'abc' })).toBeNull();
    expect(alertRequest({ ...form, symbol: '' })).toBeNull();
  });

  it('hints how far the target is from the last price', () => {
    const request = alertRequest(form);

    expect(alertTargetHint(request, 2_000_000, copy)).toBe(
      copy.t.alerts.aboveCurrent({ pct: '25.00%' }),
    );
    expect(alertTargetHint(request, 2_500_000, copy)).toBeUndefined();
  });
});
