import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useStocks } from '@sarwa/core';
import {
  DEFAULT_CIRCUIT_BREAKER,
  useAdminSession,
  useAdminStocks,
  useAdminTrading,
  useCreateHalt,
  useHaltImpact,
  useResumeHalt,
  useUpdateStock,
  useUpdateTrading,
} from '@sarwa/core/admin';

import { TradingPage } from '../../src/features/trading/trading-page';
import {
  makeTrading,
  mutation,
  query,
  renderWithProviders,
  session,
  succeedingMutation,
} from '../utils';

jest.mock('@sarwa/core', () => ({
  ...jest.requireActual<object>('@sarwa/core'),
  useStocks: jest.fn(),
}));
jest.mock('@sarwa/core/admin', () => ({
  ...jest.requireActual<object>('@sarwa/core/admin'),
  useAdminSession: jest.fn(),
  useAdminTrading: jest.fn(),
  useUpdateTrading: jest.fn(),
  useResumeHalt: jest.fn(),
  useAdminStocks: jest.fn(),
  useUpdateStock: jest.fn(),
  useCreateHalt: jest.fn(),
  useHaltImpact: jest.fn(),
}));

const stock = (symbol: string, name: string) => ({
  symbol,
  name,
  sector: 'tech' as const,
  exchange: 'NASDAQ' as const,
  currency: 'USD' as const,
  sparkline: [1, 2],
  marketCap: 1,
  quote: {} as never,
});

function setup({
  role = 'ADMIN',
  impact = null,
  trading = {},
}: { role?: 'ADMIN' | 'VIEWER'; impact?: object | null; trading?: object } = {}) {
  const update = succeedingMutation();
  const create = mutation();
  const resume = mutation();
  jest.mocked(useAdminSession).mockReturnValue(session(role));
  jest.mocked(useAdminTrading).mockReturnValue(
    query(
      makeTrading({
        halts: [
          {
            symbol: 'TSLA',
            source: 'circuit_breaker',
            message: 'Circuit breaker · −10.2% in 5 min',
            since: 1_000,
            resumesAt: 2_000,
          },
        ],
        ...trading,
      }),
    ),
  );
  jest.mocked(useUpdateTrading).mockReturnValue(update as never);
  jest.mocked(useResumeHalt).mockReturnValue(resume as never);
  jest.mocked(useAdminStocks).mockReturnValue(query([]));
  jest.mocked(useUpdateStock).mockReturnValue(mutation() as never);
  jest.mocked(useCreateHalt).mockReturnValue(create as never);
  jest.mocked(useHaltImpact).mockReturnValue(query(impact));
  jest
    .mocked(useStocks)
    .mockReturnValue(query([stock('NVDA', 'NVIDIA Corp.'), stock('TSLA', 'Tesla Inc.')]));
  const view = renderWithProviders(<TradingPage />);
  return { update, create, resume, view };
}

describe('TradingPage', () => {
  it('asks before turning trading off and resumes a halted symbol', async () => {
    const { update, resume } = setup();

    await userEvent.click(screen.getByRole('switch', { name: 'Trading enabled' }));
    const dialog = screen.getByRole('dialog', { name: 'Turn off trading?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(update.mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('switch', { name: 'Trading enabled' }));
    await userEvent.click(screen.getByRole('button', { name: 'Turn off trading' }));
    expect(update.mutate).toHaveBeenCalledWith({ tradingEnabled: false }, expect.anything());

    await userEvent.click(screen.getByRole('button', { name: 'Resume now' }));
    expect(resume.mutate).toHaveBeenCalledWith('TSLA');
  });

  it('asks before turning the circuit breaker off or switching the session mode', async () => {
    const { update } = setup({
      trading: { circuitBreaker: { ...DEFAULT_CIRCUIT_BREAKER, enabled: true } },
    });

    await userEvent.click(screen.getByRole('switch', { name: 'Circuit breaker' }));
    expect(update.mutate).not.toHaveBeenCalled();
    screen.getByRole('dialog', { name: 'Turn off the circuit breaker?' });
    await userEvent.click(screen.getByRole('button', { name: 'Turn off breaker' }));
    expect(update.mutate).toHaveBeenLastCalledWith(
      { circuitBreaker: { enabled: false } },
      expect.anything(),
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Always open' }));
    expect(update.mutate).toHaveBeenCalledTimes(1);
    screen.getByRole('dialog', { name: 'Switch session mode to Always open?' });
    await userEvent.click(screen.getByRole('button', { name: 'Switch mode' }));
    expect(update.mutate).toHaveBeenLastCalledWith(
      { sessionMode: 'always-open' },
      expect.anything(),
    );
  });

  it('turns trading and the breaker back on without asking', async () => {
    const { update } = setup({
      trading: {
        tradingEnabled: false,
        circuitBreaker: { ...DEFAULT_CIRCUIT_BREAKER, enabled: false },
      },
    });

    await userEvent.click(screen.getByRole('switch', { name: 'Trading enabled' }));
    expect(update.mutate).toHaveBeenLastCalledWith({ tradingEnabled: true });
    await userEvent.click(screen.getByRole('switch', { name: 'Circuit breaker' }));
    expect(update.mutate).toHaveBeenLastCalledWith({ circuitBreaker: { enabled: true } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('labels the halt button with the symbol and duration and warns about open orders', async () => {
    const { create } = setup({
      impact: { symbol: 'NVDA', openOrders: 14, holdersAndWatchers: 1_036 },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Halt a symbol' }));
    const dialog = screen.getByRole('dialog', { name: 'Halt a symbol' });

    expect(within(dialog).getByRole('button', { name: 'Halt NVDA for 15 min' })).toBeEnabled();
    expect(within(dialog).getByRole('radio', { name: '5 min' })).toBeInTheDocument();
    expect(
      within(dialog).getByText('14 open NVDA orders will pause. Day orders still expire at close.'),
    ).toBeInTheDocument();
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
    expect(create.mutate).not.toHaveBeenCalled();

    await userEvent.type(within(dialog).getByLabelText('Reason (shown to users)'), 'News pending');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Halt NVDA until resumed' }));
    expect(create.mutate).toHaveBeenCalledWith(
      { symbol: 'NVDA', message: 'News pending', duration: 'manual', notify: true },
      expect.anything(),
    );
  });

  it('validates execution rules before saving and sends only the changes', async () => {
    const { update } = setup();
    const spread = screen.getByLabelText('Bid/ask spread');
    const save = screen.getByRole('button', { name: 'Save rules' });
    expect(save).toBeDisabled();

    await userEvent.clear(spread);
    await userEvent.type(spread, 'abc');
    await userEvent.click(save);
    expect(screen.getByText('Enter a number')).toBeInTheDocument();
    expect(update.mutate).not.toHaveBeenCalled();

    await userEvent.clear(spread);
    await userEvent.type(spread, '0.04');
    await userEvent.click(save);
    expect(update.mutate).toHaveBeenCalledWith({ rules: { spreadBps: 4 } }, expect.anything());

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(spread).toHaveValue('0.02');
  });

  it('keeps only the rules this admin edited when another admin saves meanwhile', async () => {
    const { update, view } = setup();
    const spread = screen.getByLabelText('Bid/ask spread');
    await userEvent.clear(spread);
    await userEvent.type(spread, '0.04');

    jest
      .mocked(useAdminTrading)
      .mockReturnValue(query(makeTrading({ rules: { ...makeTrading().rules, collarBps: 900 } })));
    view.rerender(<TradingPage />);
    expect(screen.getByLabelText('Limit price collar')).toHaveValue('9');
    expect(spread).toHaveValue('0.04');

    await userEvent.click(screen.getByRole('button', { name: 'Save rules' }));
    expect(update.mutate).toHaveBeenCalledWith({ rules: { spreadBps: 4 } }, expect.anything());
  });

  it('keeps controls visible but locked for viewers', async () => {
    const { update } = setup({ role: 'VIEWER' });

    expect(screen.getByText('View-only access.')).toBeInTheDocument();
    expect(screen.getByText('Read-only')).toBeInTheDocument();
    const killSwitch = screen.getByRole('switch', { name: 'Trading enabled' });
    expect(killSwitch).toHaveAttribute('aria-disabled', 'true');
    expect(killSwitch).toHaveAccessibleDescription("Viewers can't make changes");
    act(() => {
      killSwitch.focus();
    });
    expect(killSwitch).toHaveFocus();
    await userEvent.click(killSwitch);
    await userEvent.keyboard(' ');
    expect(update.mutate).not.toHaveBeenCalled();
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
  });
});
