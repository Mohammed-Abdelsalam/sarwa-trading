import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Candle } from '@sarwa/contracts';
import { formatCandleDate, formatPrice, useChartSeries } from '@sarwa/core';

import { PriceChart } from '../../../src/features/stock-detail/price-chart';

jest.mock('@sarwa/core', () => ({
  ...jest.requireActual<object>('@sarwa/core'),
  useChartSeries: jest.fn(),
}));

const candles: Candle[] = [
  { t: 1_700_000_000_000, o: 10, h: 11, l: 9, c: 10, v: 100 },
  { t: 1_700_000_300_000, o: 10, h: 13, l: 10, c: 12, v: 200 },
  { t: 1_700_000_600_000, o: 12, h: 12, l: 10, c: 11, v: 150 },
];

function mockSeries(overrides: Partial<ReturnType<typeof useChartSeries>> = {}) {
  jest.mocked(useChartSeries).mockReturnValue({
    candles,
    baseline: 10,
    showBaseline: false,
    rising: true,
    axisCandles: candles,
    summary: 'AAPL is up 10% today',
    periodChange: null,
    state: 'ready',
    retry: jest.fn(),
    ...overrides,
  });
}

function pointText(candle: Candle) {
  return `${formatCandleDate(candle.t, '1D')}, ${formatPrice(candle.c)}`;
}

describe('PriceChart', () => {
  it('describes the whole chart until a point is picked', () => {
    mockSeries();
    render(<PriceChart symbol="AAPL" period="1D" />);

    expect(screen.getByRole('slider', { name: 'AAPL price chart' })).toHaveAttribute(
      'aria-valuetext',
      'AAPL is up 10% today',
    );
  });

  it('steps through points with the arrow keys and leaves with Escape', async () => {
    mockSeries();
    render(<PriceChart symbol="AAPL" period="1D" />);
    const chart = screen.getByRole('slider', { name: 'AAPL price chart' });

    chart.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(chart).toHaveAttribute('aria-valuetext', pointText(candles[1]!));
    expect(screen.getByRole('slider', { value: { now: 1 } })).toBe(chart);

    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('slider', { value: { now: 2 } })).toBe(chart);

    await userEvent.keyboard('{Escape}');
    expect(chart).toHaveAttribute('aria-valuetext', 'AAPL is up 10% today');
  });

  it('shows an error with retry when history fails to load', async () => {
    const retry = jest.fn();
    mockSeries({ state: 'error', retry });
    render(<PriceChart symbol="AAPL" period="1W" />);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Chart unavailable');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows open, high, low and close for the scrubbed candle in candlestick mode', async () => {
    mockSeries();
    render(<PriceChart symbol="AAPL" period="1D" type="candle" />);

    screen.getByRole('slider', { name: 'AAPL price chart' }).focus();
    await userEvent.keyboard('{ArrowLeft}');

    for (const label of ['Open', 'High', 'Low', 'Close']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Candle 2 opened and bottomed at $10.00; only its OHLC rows show that value.
    expect(screen.getAllByText('$10.00')).toHaveLength(2);
  });
});
