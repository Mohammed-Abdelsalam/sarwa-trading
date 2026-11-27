import { fireEvent, screen } from '@testing-library/react-native';
import { type ReactNode } from 'react';

import { bps } from '@sarwa/core';

import { PortfolioScreen } from '../../../src/features/portfolio/portfolio-screen';
import { usePortfolioScreen } from '../../../src/features/portfolio/use-portfolio-screen';
import { renderScreen } from '../../render';

jest.mock('../../../src/features/portfolio/use-portfolio-screen');
jest.mock('../../../src/components/layout/app-banners', () => ({ AppBanners: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({
    children,
    renderRightActions,
  }: {
    children: ReactNode;
    renderRightActions: () => ReactNode;
  }) => (
    <>
      {children}
      {renderRightActions()}
    </>
  ),
}));

const mockedHook = jest.mocked(usePortfolioScreen);
type Vm = ReturnType<typeof usePortfolioScreen>;

const summary: NonNullable<Vm['summary']> = {
  equity: '$104,213.55',
  today: { label: '+$812.40 (+0.79%)', direction: 'up' },
  stats: [
    { key: 'cash', label: 'Cash', value: { label: '$41,522.10', direction: 'flat' } },
    { key: 'realized', label: 'Realized YTD', value: { label: '+$1,284.60', direction: 'up' } },
  ],
  allocation: [
    { key: 'tech', label: 'Tech', share: bps(5200), pct: '52.00%' },
    { key: 'cash', label: 'Cash', share: bps(4000), pct: '40.00%' },
  ],
  positionsTitle: 'Positions · 1',
  positions: [
    {
      symbol: 'AAPL',
      sector: 'tech',
      holding: '42 sh · avg $198.40',
      details: 'Last $231.48 · Today +$51.24 · Weight 9.30%',
      value: '$9,722.16',
      total: { label: '+$1,389.36 (+16.67%)', direction: 'up' },
    },
  ],
};

function viewModel(overrides: Partial<Vm> = {}): Vm {
  return {
    isLoading: false,
    isError: false,
    period: '1D',
    periods: ['1D', '1W', '1M', '1Y', 'ALL'],
    curve: { values: [1, 2, 3], rising: true },
    explaining: false,
    summary,
    actions: {
      setPeriod: jest.fn(),
      retry: jest.fn(),
      explain: jest.fn(),
      closeExplain: jest.fn(),
    },
    ...overrides,
  };
}

describe('PortfolioScreen', () => {
  it('shows equity, the summary stats and the allocation legend', async () => {
    mockedHook.mockReturnValue(viewModel());
    await renderScreen(<PortfolioScreen />);

    expect(screen.getByText('$104,213.55')).toBeOnTheScreen();
    expect(screen.getByText('▲ +$812.40 (+0.79%)')).toBeOnTheScreen();
    expect(screen.getByText('$41,522.10')).toBeOnTheScreen();
    expect(screen.getByText('+$1,284.60')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Allocation by sector: Tech 52.00%, Cash 40.00%'),
    ).toBeOnTheScreen();
  });

  it('lists positions with buy and sell row actions', async () => {
    mockedHook.mockReturnValue(viewModel());
    await renderScreen(<PortfolioScreen />);

    expect(screen.getByText('Positions · 1')).toBeOnTheScreen();
    expect(screen.getByText('42 sh · avg $198.40')).toBeOnTheScreen();
    expect(screen.getByText('$9,722.16')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Buy AAPL' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sell AAPL' })).toBeOnTheScreen();
  });

  it('changes the equity period and opens the P&L explainer', async () => {
    const model = viewModel();
    mockedHook.mockReturnValue(model);
    await renderScreen(<PortfolioScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: '1M' }));
    await fireEvent.press(screen.getByRole('button', { name: 'How P&L is calculated' }));

    expect(model.actions.setPeriod).toHaveBeenCalledWith('1M');
    expect(model.actions.explain).toHaveBeenCalledTimes(1);
  });

  it('explains P&L in a sheet', async () => {
    mockedHook.mockReturnValue(viewModel({ explaining: true }));
    await renderScreen(<PortfolioScreen />);

    expect(screen.getByText('How P&L works')).toBeOnTheScreen();
    expect(screen.getByText(/We use average cost/)).toBeOnTheScreen();
  });

  it('invites a first trade when there are no positions', async () => {
    mockedHook.mockReturnValue(
      viewModel({ summary: { ...summary, positions: [], positionsTitle: 'Positions · 0' } }),
    );
    await renderScreen(<PortfolioScreen />);

    expect(
      screen.getByText('No positions yet. Buy a stock to start your paper portfolio.'),
    ).toBeOnTheScreen();
  });

  it('offers a retry when the portfolio fails to load', async () => {
    const model = viewModel({ isError: true, summary: null });
    mockedHook.mockReturnValue(model);
    await renderScreen(<PortfolioScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(model.actions.retry).toHaveBeenCalledTimes(1);
  });
});
