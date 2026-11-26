import { act, renderHook, waitFor } from '@testing-library/react';

import { type Candle } from '@sarwa/contracts';

import { useChartSeries, useMarketList, useStockDetail, useStocks } from '../../src/hooks';
import { SORTS } from '../../src/markets';
import { createTestClient, createWrapper, makeProblem, makeQuote, makeStock } from '../utils';

const candle = (t: number, c: number): Candle => ({ t, o: c, h: c, l: c, c, v: 1 });

describe('useStocks', () => {
  it('seeds the live store with the REST snapshot', async () => {
    const stock = makeStock('NVDA');
    const client = createTestClient({ listStocks: () => Promise.resolve({ items: [stock] }) });
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => useStocks(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(client.store.getState().quotes.NVDA).toEqual(stock.quote);
  });
});

describe('useMarketList', () => {
  it('filters and sorts the snapshot', async () => {
    const { Wrapper } = createWrapper(
      createTestClient({
        listStocks: () =>
          Promise.resolve({
            items: [makeStock('JPM', { sector: 'fin' }), makeStock('AAPL', { sector: 'tech' })],
          }),
      }),
    );

    const { result } = renderHook(
      () => useMarketList({ query: '', sector: 'fin', sort: SORTS[0] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.rows.map((s) => s.symbol)).toEqual(['JPM']);
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('is an error without cached data and refetches on refresh', async () => {
    const listStocks = jest.fn(() => Promise.reject(makeProblem(503)));
    const { Wrapper } = createWrapper(createTestClient({ listStocks }));
    const { result } = renderHook(
      () => useMarketList({ query: '', sector: 'all', sort: SORTS[0] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(listStocks).toHaveBeenCalledTimes(2);
    });
  });
});

describe('useStockDetail', () => {
  const detail = {
    stock: { symbol: 'AAPL', name: 'Apple', sector: 'tech', exchange: 'NASDAQ', currency: 'USD' },
    quote: makeQuote({ price: 200 }),
    stats: { marketCap: 1, peRatio: 30, week52High: 250, week52Low: 150, avgVolume: 1 },
  } as const;

  it('streams the symbol and prefers the live quote over the snapshot', async () => {
    const client = createTestClient({ getStock: () => Promise.resolve(detail) });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useStockDetail('AAPL'), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.stats).not.toBeNull();
    });
    expect(client.market.acquire).toHaveBeenCalledWith(['AAPL']);

    act(() => {
      client.store.getState().applyQuotes([makeQuote({ price: 205, ts: 9_999 })]);
    });

    expect(result.current.quote?.price).toBe(205);
    expect(result.current.stock?.name).toBe('Apple');
  });

  it('tells a missing stock apart from a failed request', async () => {
    const { Wrapper } = createWrapper(
      createTestClient({ getStock: () => Promise.reject(makeProblem(404)) }),
    );

    const { result } = renderHook(() => useStockDetail('ZZZZ'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.notFound).toBe(true);
    });
    expect(result.current.isError).toBe(false);
  });

  it('reports other failures as errors that can be retried', async () => {
    const getStock = jest.fn(() => Promise.reject(makeProblem(503)));
    const { Wrapper } = createWrapper(createTestClient({ getStock }));
    const { result } = renderHook(() => useStockDetail('AAPL'), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(getStock).toHaveBeenCalledTimes(2);
    });
  });
});

describe('useChartSeries', () => {
  it('moves the last candle to the live price and measures 1D against the previous close', async () => {
    const client = createTestClient({
      getCandles: () =>
        Promise.resolve({
          symbol: 'AAPL',
          period: '1D',
          candles: [candle(1, 100), candle(2, 101), candle(3, 102)],
        }),
    });
    client.store.getState().applyQuotes([makeQuote({ price: 98, prevClose: 99 })]);
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => useChartSeries('AAPL', '1D'), { wrapper: Wrapper });
    expect(result.current.state).toBe('loading');

    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });
    expect(result.current.candles.at(-1)?.c).toBe(98);
    expect(result.current.baseline).toBe(99);
    expect(result.current.showBaseline).toBe(true);
    expect(result.current.rising).toBe(false);
    expect(result.current.axisCandles).toHaveLength(5);
  });

  it('reports an error and refetches on retry', async () => {
    const getCandles = jest.fn(() => Promise.reject(makeProblem(503)));
    const { Wrapper } = createWrapper(createTestClient({ getCandles }));

    const { result } = renderHook(() => useChartSeries('AAPL', '1M'), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.state).toBe('error');
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(getCandles).toHaveBeenCalledTimes(2);
    });
    expect(result.current.showBaseline).toBe(false);
  });
});
