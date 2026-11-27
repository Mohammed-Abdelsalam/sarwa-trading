import { act, renderHook, waitFor } from '@testing-library/react';

import { useHomeView } from '../../src/hooks/home';
import { queryKeys } from '../../src/hooks/keys';
import { makeOrder } from '../trading-fixtures';
import { createAuthClient, createWrapper, makeStock, makeUser } from '../utils';

const STOCKS = [
  makeStock('AAPL', { marketCap: 3 }, { price: 240, volume: 10 }),
  makeStock('TSLA', { marketCap: 1 }, { price: 200, volume: 99 }),
];

function setup(
  status: 'guest' | 'authenticated',
  { verified = false, orders = [] as ReturnType<typeof makeOrder>[] } = {},
) {
  const listOrders = jest.fn(() => Promise.resolve({ items: orders, nextCursor: null }));
  const client = createAuthClient(
    { listOrders },
    { status, user: makeUser({ emailVerified: verified }) },
  );
  const { Wrapper, queryClient } = createWrapper(client);
  queryClient.setQueryData(queryKeys.stocks, STOCKS);
  const view = renderHook(() => useHomeView(), { wrapper: Wrapper });
  return { ...view, listOrders };
}

describe('useHomeView', () => {
  it('gives a guest the landing: hero, steps, movers and heatmap', () => {
    const { result, listOrders } = setup('guest');

    expect(result.current.mode).toBe('guest');
    expect(result.current.guest).toMatchObject({
      title: 'Start practicing with $100,000',
      steps: [
        { key: 'signUp', label: 'Sign up in 30 s' },
        { key: 'cash', label: 'Get $100,000 virtual cash' },
        { key: 'trade', label: 'Place your first trade' },
      ],
      createAccount: 'Create free account',
    });
    expect(result.current.guest?.body).toContain('Trade 2 US stocks');
    expect(result.current.checklist).toBeNull();
    expect(result.current.heatmap.map((tile) => tile.key)).toEqual(['AAPL', 'TSLA']);
    expect(listOrders).not.toHaveBeenCalled();

    act(() => {
      result.current.movers.setTab('active');
    });
    expect(result.current.movers.rows.map((stock) => stock.symbol)).toEqual(['TSLA', 'AAPL']);
  });

  it('walks a new member through verifying and a first trade', async () => {
    const { result } = setup('authenticated');

    await waitFor(() => {
      expect(result.current.checklist).not.toBeNull();
    });
    expect(result.current.mode).toBe('member');
    expect(result.current.guest).toBeNull();
    expect(result.current.checklist?.items.map(({ key, done }) => ({ key, done }))).toEqual([
      { key: 'created', done: true },
      { key: 'verify', done: false },
      { key: 'firstTrade', done: false },
    ]);
  });

  it('drops the checklist once every step is done', async () => {
    const { result, listOrders } = setup('authenticated', {
      verified: true,
      orders: [makeOrder()],
    });

    await waitFor(() => {
      expect(listOrders).toHaveBeenCalled();
    });
    expect(result.current.checklist).toBeNull();
  });
});
