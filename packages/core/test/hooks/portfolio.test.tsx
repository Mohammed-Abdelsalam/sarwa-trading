import { act, renderHook, waitFor } from '@testing-library/react';

import { useAccount, useEquityCurve, usePortfolio } from '../../src/hooks';
import { makePortfolio } from '../trading-fixtures';
import { createTestClient, createWrapper, makeQuote, makeStock } from '../utils';

describe('usePortfolio', () => {
  it('moves the live summary with every quote of a held symbol', async () => {
    const client = createTestClient({
      getPortfolio: () => Promise.resolve(makePortfolio()),
      listStocks: () => Promise.resolve({ items: [makeStock('AAPL', {}, { price: 200 })] }),
    });
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => usePortfolio(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.summary?.positions[0]?.marketValueCents).toBe(200_000);
    });

    act(() => {
      client.store.getState().applyQuotes([makeQuote({ price: 240, ts: 5_000 })]);
    });

    expect(result.current.summary?.positions[0]?.marketValueCents).toBe(240_000);
    expect(result.current.summary?.unrealizedCents).toBe(40_000);
    expect(result.current.summary?.equityCents).toBe(1_240_000);
    expect(client.market.acquire).toHaveBeenCalledWith(['AAPL']);
  });

  it('values a position with no quote at its average cost', async () => {
    const client = createTestClient({
      getPortfolio: () => Promise.resolve(makePortfolio()),
      listStocks: () => Promise.resolve({ items: [] }),
    });
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => usePortfolio(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.summary?.positions[0]?.marketValueCents).toBe(200_000);
    });
    expect(result.current.summary?.unrealizedCents).toBe(0);
  });

  it('exposes buying power, reserved cash and sellable shares net of open orders', async () => {
    const client = createTestClient({
      getPortfolio: () =>
        Promise.resolve(
          makePortfolio({
            holds: [
              { orderId: 'a', side: 'buy', symbol: 'TSLA', heldCents: 50_000, heldMicros: 0 },
              { orderId: 'b', side: 'sell', symbol: 'AAPL', heldCents: 0, heldMicros: 4_000_000 },
            ],
          }),
        ),
      listStocks: () => Promise.resolve({ items: [] }),
    });
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => usePortfolio(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.buyingPowerCents).toBe(950_000);
    });
    expect(result.current.reservedCents).toBe(50_000);
    expect(result.current.sellableMicros('AAPL')).toBe(6_000_000);
    expect(result.current.sellableMicros('NVDA')).toBe(0);
    expect(result.current.position('AAPL')?.qtyMicros).toBe(10_000_000);
    expect(result.current.position('NVDA')).toBeNull();
  });
});

describe('useAccount and useEquityCurve', () => {
  it('load the account and the equity points for a period', async () => {
    const getEquity = jest.fn(() =>
      Promise.resolve({ period: '1W' as const, points: [{ t: 1, equityCents: 10 }] }),
    );
    const client = createTestClient({
      getAccount: () => Promise.resolve(makePortfolio().account),
      getEquity,
    });
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => ({ account: useAccount(), equity: useEquityCurve('1W') }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.equity.data?.points).toHaveLength(1);
    });
    await waitFor(() => {
      expect(result.current.account.data?.handle).toBe('ACC-ABC123');
    });
    expect(getEquity).toHaveBeenCalledWith('1W', { signal: expect.any(AbortSignal) });
  });
});
