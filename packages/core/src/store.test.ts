import { createLiveStore } from './store';
import { makeQuote } from './test-utils';

describe('live store', () => {
  it('applies a batch of quotes in a single update', () => {
    const store = createLiveStore();
    const listener = jest.fn();
    store.subscribe(listener);

    store.getState().applyQuotes([makeQuote(), makeQuote({ symbol: 'TSLA' })]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(Object.keys(store.getState().quotes)).toEqual(['AAPL', 'TSLA']);
  });

  it('drops out-of-order quotes and does not notify when nothing is newer', () => {
    const store = createLiveStore();
    store.getState().applyQuotes([makeQuote({ ts: 2_000, seq: 5, price: 230 })]);
    const listener = jest.fn();
    store.subscribe(listener);

    store.getState().applyQuotes([makeQuote({ ts: 1_500, seq: 9, price: 999 })]);

    expect(listener).not.toHaveBeenCalled();
    expect(store.getState().quotes.AAPL?.price).toBe(230);
  });

  it('accepts a quote after a server restart because its timestamp is newer', () => {
    const store = createLiveStore();
    store.getState().applyQuotes([makeQuote({ ts: 1_000, seq: 500 })]);
    store.getState().applyQuotes([makeQuote({ ts: 2_000, seq: 0, price: 240 })]);
    expect(store.getState().quotes.AAPL?.price).toBe(240);
  });

  it('ignores an app config older than the one it has', () => {
    const store = createLiveStore();
    const config = { maintenanceMode: false, banner: null, enabledPeriods: ['1D' as const] };
    store.getState().setAppConfig({ ...config, updatedAt: 2 });
    store.getState().setAppConfig({ ...config, maintenanceMode: true, updatedAt: 1 });
    expect(store.getState().appConfig?.maintenanceMode).toBe(false);
  });
});
