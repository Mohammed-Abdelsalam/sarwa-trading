import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AdminTrading, type AdminUser, type UpdateTrading } from '@sarwa/contracts';
import { DEFAULT_CIRCUIT_BREAKER } from '@sarwa/core/admin';

import { TradingPage } from '../../src/features/trading/trading-page';
import { type ApiCall, makeTrading, me, renderWithApi } from '../utils';

const quote = (symbol: string) => ({
  symbol,
  price: 100,
  bid: 99.9,
  ask: 100.1,
  bidSize: 1,
  askSize: 1,
  prevClose: 100,
  open: 100,
  dayHigh: 101,
  dayLow: 99,
  volume: 1,
  ts: 1_000,
  seq: 1,
});

const stock = (symbol: string, name: string) => ({
  symbol,
  name,
  sector: 'tech',
  exchange: 'NASDAQ',
  currency: 'USD',
  quote: quote(symbol),
  sparkline: [1, 2],
  marketCap: 1,
});

const halt = {
  symbol: 'TSLA',
  source: 'circuit_breaker',
  message: 'Circuit breaker · −10.2% in 5 min',
  since: 1_000,
  resumesAt: 2_000,
} as const;

function setup({
  role = 'ADMIN',
  impact = { symbol: 'NVDA', openOrders: 0, holdersAndWatchers: 0 },
  trading = {},
}: { role?: AdminUser['role']; impact?: object; trading?: Partial<AdminTrading> } = {}) {
  const server = { trading: makeTrading({ halts: [halt], ...trading }) };
  const view = renderWithApi(<TradingPage />, {
    'GET admin/auth/me': me(role),
    'GET admin/trading': () => server.trading,
    'PATCH admin/trading': (call: ApiCall) => {
      const patch = call.body as UpdateTrading;
      server.trading = {
        ...server.trading,
        ...patch,
        rules: { ...server.trading.rules, ...patch.rules },
        circuitBreaker: { ...server.trading.circuitBreaker, ...patch.circuitBreaker },
      };
      return server.trading;
    },
    'POST admin/halts/TSLA/resume': null,
    'POST admin/halts': { ...halt, symbol: 'NVDA', source: 'admin', resumesAt: null },
    'GET admin/halts/impact': impact,
    'GET admin/stocks': { items: [] },
    'GET stocks': { items: [stock('NVDA', 'NVIDIA Corp.'), stock('TSLA', 'Tesla Inc.')] },
  });
  return { ...view, server };
}

const writes = (calls: ApiCall[]) =>
  calls.filter((call) => call.method !== 'GET').map((call) => [call.path, call.body]);

describe('TradingPage', () => {
  it('asks before turning trading off and resumes a halted symbol', async () => {
    const { calls } = setup();

    await userEvent.click(await screen.findByRole('switch', { name: 'Trading enabled' }));
    const dialog = screen.getByRole('dialog', { name: 'Turn off trading?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(writes(calls)).toEqual([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('switch', { name: 'Trading enabled' }));
    await userEvent.click(screen.getByRole('button', { name: 'Turn off trading' }));
    await waitFor(() => {
      expect(writes(calls)).toEqual([['admin/trading', { tradingEnabled: false }]]);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Resume now' }));
    await waitFor(() => {
      expect(writes(calls).at(-1)).toEqual(['admin/halts/TSLA/resume', undefined]);
    });
  });

  it('asks before turning the circuit breaker off or switching the session mode', async () => {
    const { calls } = setup({
      trading: { circuitBreaker: { ...DEFAULT_CIRCUIT_BREAKER, enabled: true } },
    });

    await userEvent.click(await screen.findByRole('switch', { name: 'Circuit breaker' }));
    expect(writes(calls)).toEqual([]);
    screen.getByRole('dialog', { name: 'Turn off the circuit breaker?' });
    await userEvent.click(screen.getByRole('button', { name: 'Turn off breaker' }));
    await waitFor(() => {
      expect(writes(calls)).toEqual([['admin/trading', { circuitBreaker: { enabled: false } }]]);
    });

    await userEvent.click(screen.getByRole('radio', { name: 'Always open' }));
    expect(writes(calls)).toHaveLength(1);
    screen.getByRole('dialog', { name: 'Switch session mode to Always open?' });
    await userEvent.click(screen.getByRole('button', { name: 'Switch mode' }));
    await waitFor(() => {
      expect(writes(calls).at(-1)).toEqual(['admin/trading', { sessionMode: 'always-open' }]);
    });
  });

  it('turns trading and the breaker back on without asking', async () => {
    const { calls } = setup({
      trading: {
        tradingEnabled: false,
        circuitBreaker: { ...DEFAULT_CIRCUIT_BREAKER, enabled: false },
      },
    });

    await userEvent.click(await screen.findByRole('switch', { name: 'Trading enabled' }));
    await waitFor(() => {
      expect(writes(calls)).toEqual([['admin/trading', { tradingEnabled: true }]]);
    });
    await userEvent.click(screen.getByRole('switch', { name: 'Circuit breaker' }));
    await waitFor(() => {
      expect(writes(calls).at(-1)).toEqual([
        'admin/trading',
        { circuitBreaker: { enabled: true } },
      ]);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('labels the halt button with the symbol and duration and warns about open orders', async () => {
    const { calls } = setup({
      impact: { symbol: 'NVDA', openOrders: 14, holdersAndWatchers: 1_036 },
    });

    const open = await screen.findByRole('button', { name: 'Halt a symbol' });
    await waitFor(() => {
      expect(calls.map((call) => call.path)).toContain('stocks');
    });
    await userEvent.click(open);
    const dialog = screen.getByRole('dialog', { name: 'Halt a symbol' });

    expect(within(dialog).getByRole('button', { name: 'Halt NVDA for 15 min' })).toBeEnabled();
    expect(within(dialog).getByRole('radio', { name: '5 min' })).toBeInTheDocument();
    expect(
      await within(dialog).findByText(
        '14 open NVDA orders will pause. Day orders still expire at close.',
      ),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.path === 'admin/halts/impact')?.query.get('symbol')).toBe(
      'NVDA',
    );
    expect(
      within(dialog).getByRole('checkbox', { name: 'Notify 1,036 holders & watchers' }),
    ).toBeChecked();

    await userEvent.click(within(dialog).getByRole('radio', { name: 'Until close' }));
    expect(
      within(dialog).getByRole('button', { name: 'Halt NVDA until close' }),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Manual' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Halt NVDA until resumed' }));
    expect(within(dialog).getByText('Tell users why trading is paused')).toBeInTheDocument();
    expect(writes(calls)).toEqual([]);

    await userEvent.type(within(dialog).getByLabelText('Reason (shown to users)'), 'News pending');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Halt NVDA until resumed' }));
    await waitFor(() => {
      expect(writes(calls)).toEqual([
        [
          'admin/halts',
          { symbol: 'NVDA', message: 'News pending', duration: 'manual', notify: true },
        ],
      ]);
    });
  });

  it('validates execution rules before saving and sends only the changes', async () => {
    const { calls } = setup();
    const spread = await screen.findByLabelText('Bid/ask spread');
    const save = screen.getByRole('button', { name: 'Save rules' });
    expect(save).toBeDisabled();

    await userEvent.clear(spread);
    await userEvent.type(spread, 'abc');
    await userEvent.click(save);
    expect(screen.getByText('Enter a number')).toBeInTheDocument();
    expect(writes(calls)).toEqual([]);

    await userEvent.clear(spread);
    await userEvent.type(spread, '0.04');
    await userEvent.click(save);
    await waitFor(() => {
      expect(writes(calls)).toEqual([['admin/trading', { rules: { spreadBps: 4 } }]]);
    });
    await waitFor(() => {
      expect(spread).toHaveValue('0.04');
    });

    await userEvent.clear(spread);
    await userEvent.type(spread, '0.09');
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(spread).toHaveValue('0.04');
  });

  it('keeps only the rules this admin edited when another admin saves meanwhile', async () => {
    const { calls, server, queryClient } = setup();
    const spread = await screen.findByLabelText('Bid/ask spread');
    await userEvent.clear(spread);
    await userEvent.type(spread, '0.04');

    server.trading = makeTrading({ rules: { ...makeTrading().rules, collarBps: 900 } });
    await act(() => queryClient.invalidateQueries());
    await waitFor(() => {
      expect(screen.getByLabelText('Limit price collar')).toHaveValue('9');
    });
    expect(spread).toHaveValue('0.04');

    await userEvent.click(screen.getByRole('button', { name: 'Save rules' }));
    await waitFor(() => {
      expect(writes(calls)).toEqual([['admin/trading', { rules: { spreadBps: 4 } }]]);
    });
  });

  it('keeps controls visible but locked for viewers', async () => {
    const { calls } = setup({ role: 'VIEWER' });

    expect(await screen.findByText('View-only access.')).toBeInTheDocument();
    expect(screen.getByText('Read-only')).toBeInTheDocument();
    const killSwitch = await screen.findByRole('switch', { name: 'Trading enabled' });
    expect(killSwitch).toHaveAttribute('aria-disabled', 'true');
    expect(killSwitch).toHaveAccessibleDescription("Viewers can't make changes");
    act(() => {
      killSwitch.focus();
    });
    expect(killSwitch).toHaveFocus();
    await userEvent.click(killSwitch);
    await userEvent.keyboard(' ');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const halt = screen.getByRole('button', { name: 'Halt a symbol' });
    expect(halt).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(halt);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Bid/ask spread')).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Always open' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Queue orders while closed' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Save rules' })).toHaveAccessibleDescription(
      "Viewers can't make changes",
    );
    expect(writes(calls)).toEqual([]);
  });
});
