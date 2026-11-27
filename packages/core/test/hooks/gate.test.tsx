import { act, renderHook, waitFor } from '@testing-library/react';

import { useAlertForm } from '../../src/hooks/alerts';
import { useGate, useRequireAuth, useResumeIntent } from '../../src/hooks/gate';
import { useMarkAllRead } from '../../src/hooks/notifications';
import { usePlaceOrder } from '../../src/hooks/orders';
import { initialTicketForm } from '../../src/ticket';
import { createAuthClient, createTestClient, createWrapper, makeUser } from '../utils';

const ORDER = {
  symbol: 'AAPL',
  side: 'buy' as const,
  type: 'market' as const,
  tif: 'day' as const,
  size: { kind: 'amount' as const, cents: 50_000 },
  quotedTicks: 2_315_000,
};

describe('useRequireAuth', () => {
  it('runs the action for a signed-in customer', () => {
    const { Wrapper } = createWrapper(createAuthClient({}, { status: 'authenticated' }));
    const action = jest.fn();
    const { result } = renderHook(() => useRequireAuth(), { wrapper: Wrapper });

    result.current.run({ kind: 'portfolio' }, action);

    expect(result.current.allowed).toBe(true);
    expect(action).toHaveBeenCalled();
  });

  it('opens the gate for a guest and keeps the intent for after sign-in', async () => {
    const client = createAuthClient();
    const { Wrapper } = createWrapper(client);
    const action = jest.fn();
    const { result } = renderHook(() => ({ require: useRequireAuth(), gate: useGate() }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.require.run({ kind: 'alert', symbol: 'AAPL' }, action);
    });

    expect(action).not.toHaveBeenCalled();
    expect(result.current.gate).toMatchObject({
      isOpen: true,
      intent: { kind: 'alert', symbol: 'AAPL' },
    });
    await expect(client.auth.intents.take()).resolves.toEqual({ kind: 'alert', symbol: 'AAPL' });

    act(() => {
      result.current.gate.close();
    });
    expect(result.current.gate.isOpen).toBe(false);
  });

  it('never gates when customer auth is not wired', () => {
    const { Wrapper } = createWrapper(createTestClient());
    const action = jest.fn();
    const { result } = renderHook(() => ({ require: useRequireAuth(), gate: useGate() }), {
      wrapper: Wrapper,
    });

    result.current.require.run({ kind: 'orders' }, action);

    expect(action).toHaveBeenCalled();
    expect(result.current.gate.isOpen).toBe(false);
  });
});

describe('personal actions as a guest', () => {
  it('open the gate instead of calling the server', () => {
    const api = {
      placeOrder: jest.fn(),
      createAlert: jest.fn(),
      markAllNotificationsRead: jest.fn(),
    };
    const client = createAuthClient(api);
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(
      () => ({
        order: usePlaceOrder(),
        alert: useAlertForm('AAPL'),
        inbox: useMarkAllRead(),
      }),
      { wrapper: Wrapper },
    );
    const gate = () => client.auth.gate.getState().intent;

    act(() => {
      result.current.order.submit(ORDER);
    });
    expect(gate()).toEqual({ kind: 'order', symbol: 'AAPL', side: 'buy' });

    const form = { ...initialTicketForm('buy'), amountText: '500' };
    act(() => {
      result.current.order.submit(ORDER, form);
    });
    expect(gate()).toEqual({ kind: 'order', symbol: 'AAPL', side: 'buy', form });

    act(() => {
      result.current.alert.setTarget('250');
    });
    act(() => {
      result.current.alert.submit();
    });
    expect(gate()).toEqual({
      kind: 'alert',
      symbol: 'AAPL',
      condition: 'price_above',
      target: '250',
    });

    act(() => {
      result.current.inbox.mutate();
    });
    expect(gate()).toEqual({ kind: 'notifications' });

    for (const call of Object.values(api)) expect(call).not.toHaveBeenCalled();
  });
});

describe('useResumeIntent', () => {
  it('hands back the intent once the guest signs in', async () => {
    const client = createAuthClient();
    await client.auth.intents.save({ kind: 'order', symbol: 'AAPL', side: 'sell' });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useResumeIntent(), { wrapper: Wrapper });
    expect(result.current).toBeNull();

    act(() => {
      client.auth.session.getState().signIn(makeUser());
    });

    await waitFor(() => {
      expect(result.current).toEqual({ kind: 'order', symbol: 'AAPL', side: 'sell' });
    });
    await expect(client.auth.intents.take()).resolves.toBeNull();
  });

  it('keeps the intent until a screen consumes it, so a remount never applies it twice', async () => {
    const client = createAuthClient();
    await client.auth.intents.save({ kind: 'notifications' });
    const { Wrapper } = createWrapper(client);
    const { result: root } = renderHook(() => useResumeIntent(), { wrapper: Wrapper });
    act(() => {
      client.auth.session.getState().signIn(makeUser());
    });
    await waitFor(() => {
      expect(root.current).toEqual({ kind: 'notifications' });
    });

    const { result: reader, unmount } = renderHook(() => useGate(), { wrapper: Wrapper });
    expect(reader.current.resumed).toEqual({ kind: 'notifications' });
    act(() => {
      reader.current.consume();
    });
    expect(root.current).toBeNull();
    unmount();
    expect(renderHook(() => useGate(), { wrapper: Wrapper }).result.current.resumed).toBeNull();
  });

  it('drops an unconsumed intent on sign-out', async () => {
    const client = createAuthClient();
    await client.auth.intents.save({ kind: 'orders' });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useResumeIntent(), { wrapper: Wrapper });
    act(() => {
      client.auth.session.getState().signIn(makeUser());
    });
    await waitFor(() => {
      expect(result.current).toEqual({ kind: 'orders' });
    });

    act(() => {
      client.auth.session.getState().signOut();
    });
    expect(result.current).toBeNull();
  });
});
