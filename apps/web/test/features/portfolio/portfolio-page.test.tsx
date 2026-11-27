import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PortfolioPage } from '../../../src/features/portfolio/portfolio-page';
import { downloadCsv } from '../../../src/lib/csv';
import { providers } from '../../copy';
import { makePortfolio, makeQuote, makeStock } from '../../fixtures';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push, replace: jest.fn() }),
}));
jest.mock('../../../src/lib/csv', () => ({
  ...jest.requireActual<object>('../../../src/lib/csv'),
  downloadCsv: jest.fn(),
}));

// $10,000 cash, 10 AAPL at $231.48 (cost $2,000) and 5 XOM at $110 (cost $600).
function renderPage(locale: { locale?: 'ar'; digits?: 'arab' } = {}) {
  const { wrapper } = providers({
    ...locale,
    api: {
      getPortfolio: () =>
        Promise.resolve(
          makePortfolio({
            positions: [
              {
                symbol: 'AAPL',
                sector: 'tech',
                qtyMicros: 10_000_000,
                costBasisCents: 200_000,
                today: null,
              },
              {
                symbol: 'XOM',
                sector: 'energy',
                qtyMicros: 5_000_000,
                costBasisCents: 60_000,
                today: null,
              },
            ],
            holds: [
              { orderId: 'o1', side: 'buy', symbol: 'MSFT', heldCents: 50_000, heldMicros: 0 },
            ],
          }),
        ),
      getEquity: () => Promise.resolve({ period: '1D', points: [] }),
      listStocks: () =>
        Promise.resolve({
          items: [
            makeStock('AAPL', { name: 'Apple Inc.' }),
            makeStock('XOM', {
              name: 'Exxon Mobil',
              sector: 'energy',
              quote: makeQuote({ symbol: 'XOM', price: 110, prevClose: 112 }),
            }),
          ],
        }),
    },
  });
  return render(<PortfolioPage />, { wrapper });
}

const symbolsInTable = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getByText(/^(AAPL|XOM)$/).textContent);

describe('PortfolioPage', () => {
  it('summarizes equity, cash, reserved cash and buying power', async () => {
    renderPage();

    expect(await screen.findByText('$12,864.80')).toBeInTheDocument();
    expect(screen.getByText(/since start \(\$12,000\.00\)/)).toBeInTheDocument();
    expect(screen.getByText('Reserved by open orders')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.getByText('$9,500.00')).toBeInTheDocument();
  });

  it('shows the allocation by sector with cash', async () => {
    renderPage();

    const allocation = await screen.findByRole('list', { name: 'Allocation by sector' });
    const items = within(allocation)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(items[0]).toMatch(/^Cash\$10,000\.00/);
    expect(items[1]).toMatch(/^Technology\$2,314\.80/);
    expect(items[2]).toMatch(/^Energy\$550\.00/);
  });

  it('sorts positions from the column headers and opens the ticket from a row', async () => {
    renderPage();
    await screen.findByText('Exxon Mobil');
    expect(symbolsInTable()).toEqual(['AAPL', 'XOM']);

    await userEvent.click(screen.getByRole('button', { name: 'Position' }));
    expect(screen.getByRole('columnheader', { name: 'Position' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(symbolsInTable()).toEqual(['XOM', 'AAPL']);

    await userEvent.click(screen.getByRole('button', { name: 'Sell XOM' }));
    expect(push).toHaveBeenCalledWith('/stocks/XOM?trade=sell');
  });

  it('exports the positions as CSV', async () => {
    renderPage();
    await screen.findByText('Exxon Mobil');

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    const [name, csv] = jest.mocked(downloadCsv).mock.calls[0] ?? [];
    expect(name).toBe('portfolio');
    expect(csv?.split('\n')).toEqual([
      'Symbol,Shares,Avg cost,Last,Market value,Today,Unrealized P&L,Total return,Weight',
      'AAPL,10,$200.00,$231.48,"$2,314.80",+$28.40,+$314.80,+15.74%,17.99%',
      'XOM,5,$120.00,$110.00,$550.00,−$10.00,−$50.00,−8.33%,4.28%',
    ]);
  });

  it('explains how P&L works', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'How P&L works' }));

    expect(screen.getByRole('dialog', { name: 'How P&L is calculated' })).toHaveTextContent(
      /average cost/,
    );
  });

  it('renders in Arabic with Arabic-Indic digits', async () => {
    renderPage({ locale: 'ar', digits: 'arab' });

    expect(await screen.findByText('إجمالي القيمة · حساب تجريبي')).toBeInTheDocument();
    expect((await screen.findAllByText(/١٢.٨٦٤.٨٠/)).length).toBeGreaterThan(0);
  });
});
