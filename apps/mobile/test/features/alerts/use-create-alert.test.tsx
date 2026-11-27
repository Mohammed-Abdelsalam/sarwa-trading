import { act, renderHook } from '@testing-library/react-native';
import { type ReactNode } from 'react';

import { type ApiClient } from '@sarwa/core';

import { useCreateAlertForm } from '../../../src/features/alerts/use-create-alert';
import { Providers } from '../../render';

const pending = () => new Promise<never>(() => undefined);

async function setup() {
  const createAlert = jest.fn(pending);
  const api = new Proxy(
    { createAlert },
    {
      get: (target, key) => (key === 'createAlert' ? target.createAlert : pending),
    },
  ) as unknown as ApiClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Providers api={api}>{children}</Providers>
  );
  const view = await renderHook(() => useCreateAlertForm('AAPL', jest.fn()), { wrapper });
  return { createAlert, form: () => view.result.current };
}

describe('useCreateAlertForm', () => {
  it('creates a % move alert for a down move from a negative threshold', async () => {
    const { createAlert, form } = await setup();

    await act(() => {
      form().actions.setCondition('move_today');
    });
    await act(() => {
      form().actions.setText('-5.25');
    });
    expect(form().canSubmit).toBe(true);
    await act(() => {
      form().actions.submit();
    });

    expect(createAlert).toHaveBeenCalledWith({
      symbol: 'AAPL',
      condition: 'move_today',
      repeat: 'once',
      thresholdBps: -525,
    });
  });
});
