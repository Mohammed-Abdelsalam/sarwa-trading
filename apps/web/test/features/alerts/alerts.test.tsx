import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Alert } from '@sarwa/contracts';

import { AlertDialog } from '../../../src/features/alerts/alert-dialog';
import { AlertsPage } from '../../../src/features/alerts/alerts-page';
import { providers } from '../../copy';
import { makeQuote, makeStock } from '../../fixtures';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const alert: Alert = {
  id: 'al-1',
  symbol: 'AAPL',
  condition: 'price_above',
  thresholdTicks: 2_350_000,
  thresholdBps: null,
  repeat: 'once',
  enabled: true,
  armed: true,
  lastFiredAt: null,
  createdAt: 0,
};

function setup(createAlert = jest.fn(() => Promise.resolve(alert))) {
  const { client, wrapper } = providers({
    api: {
      listStocks: () => Promise.resolve({ items: [makeStock('AAPL', { name: 'Apple Inc.' })] }),
      listAlerts: () => Promise.resolve({ items: [alert], activeCount: 1, limit: 50 }),
      createAlert,
      updateAlert: jest.fn(() => Promise.resolve({ ...alert, enabled: false })),
    },
  });
  client.store.getState().applyQuotes([makeQuote({ ts: Date.now() })]);
  return { wrapper, createAlert };
}

describe('AlertDialog', () => {
  it('explains a target the price has already passed', async () => {
    const { wrapper, createAlert } = setup();
    render(<AlertDialog initialSymbol="AAPL" onClose={jest.fn()} />, { wrapper });

    expect(await screen.findByText(/Now \$231\.48/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Price below' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Target price' }), '240');
    await userEvent.click(screen.getByRole('button', { name: 'Create alert' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      '“Below” must be under the current price ($231.48) — did you mean “above”?',
    );
    expect(createAlert).not.toHaveBeenCalled();
  });

  it('rejects text that is not a number', async () => {
    const { wrapper } = setup();
    render(<AlertDialog initialSymbol="AAPL" onClose={jest.fn()} />, { wrapper });

    await userEvent.type(await screen.findByRole('textbox', { name: 'Target price' }), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Create alert' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid number.');
  });

  it('creates a repeating price alert and closes', async () => {
    const onClose = jest.fn();
    const { wrapper, createAlert } = setup();
    render(<AlertDialog initialSymbol="AAPL" onClose={onClose} />, { wrapper });

    const target = await screen.findByRole('textbox', { name: 'Target price' });
    await userEvent.type(target, '240');
    expect(screen.getByText(/above current price/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Every time/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Create alert' }));

    expect(createAlert).toHaveBeenCalledWith({
      symbol: 'AAPL',
      condition: 'price_above',
      repeat: 'every',
      thresholdTicks: 2_400_000,
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe('AlertsPage', () => {
  const requestPermission = jest.fn(() => Promise.resolve('granted' as const));

  beforeEach(() => {
    window.history.replaceState(null, '', '/alerts');
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default', requestPermission },
    });
  });

  it('lists alerts with their distance and primes browser notifications', async () => {
    const { wrapper } = setup();
    render(<AlertsPage />, { wrapper });

    const row = await screen.findByRole('row', { name: /Price above \$235\.00/ });
    expect(row).toHaveTextContent('Now $231.48 · 1.52% away');
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(
      screen.getByText('1 active of 50 · delivered by browser notification and in-app'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Enable' }));
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('opens the create dialog for the stock in ?new=', async () => {
    window.history.replaceState(null, '', '/alerts?new=AAPL');
    const { wrapper } = setup();
    render(<AlertsPage />, { wrapper });

    expect(await screen.findByRole('dialog', { name: 'New alert · AAPL' })).toBeInTheDocument();
  });
});
