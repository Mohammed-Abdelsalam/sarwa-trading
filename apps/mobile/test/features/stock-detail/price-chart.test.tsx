import { renderHook, screen } from '@testing-library/react-native';
import { type ReactNode } from 'react';
import { Text } from 'react-native';

import { PriceChart } from '../../../src/features/stock-detail/price-chart';
import { usePriceChart } from '../../../src/features/stock-detail/use-price-chart';
import { useCopy } from '../../../src/lib/i18n';
import { layoutDirection, Providers, renderScreen } from '../../render';

jest.mock('../../../src/features/stock-detail/use-price-chart', () => ({
  usePriceChart: jest.fn(),
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: ReactNode }) => children,
}));

const mockedHook = jest.mocked(usePriceChart);

const shape = (x: number, up: boolean) => ({
  x,
  width: 6,
  bodyTop: 10,
  bodyHeight: 20,
  wickTop: 5,
  wickBottom: 40,
  up,
  closeY: 10,
  volume: 0.5,
});

function chart(
  overrides: Partial<ReturnType<typeof usePriceChart>> = {},
): ReturnType<typeof usePriceChart> {
  return {
    state: 'ready',
    retry: jest.fn(),
    summary: 'AAPL up 1.00% today',
    periodChange: null,
    line: 'M0 0L10 10',
    area: 'M0 0L10 10Z',
    candles: [shape(10, true), shape(30, false)],
    rising: true,
    baselineY: null,
    lastPoint: null,
    axisLabels: [],
    scrubGesture: {} as ReturnType<typeof usePriceChart>['scrubGesture'],
    crosshairProps: {},
    dotProps: {},
    haloProps: {},
    ...overrides,
  };
}

describe('PriceChart', () => {
  it('draws one body per candle in candlestick mode', async () => {
    mockedHook.mockReturnValue(chart());
    await renderScreen(<PriceChart symbol="AAPL" period="1M" type="candle" onScrub={jest.fn()} />);

    expect(screen.getAllByTestId('candle')).toHaveLength(2);
    expect(screen.getByLabelText('AAPL up 1.00% today')).toBeOnTheScreen();
  });

  it('draws the area line, not candles, in area mode', async () => {
    mockedHook.mockReturnValue(chart());
    await renderScreen(<PriceChart symbol="AAPL" period="1M" type="area" onScrub={jest.fn()} />);

    expect(screen.queryAllByTestId('candle')).toHaveLength(0);
  });

  it('keeps the toolbar below the chart while it loads', async () => {
    mockedHook.mockReturnValue(chart({ state: 'loading' }));
    await renderScreen(
      <PriceChart
        symbol="AAPL"
        period="1M"
        type="area"
        onScrub={jest.fn()}
        footer={() => <Text>toolbar</Text>}
      />,
    );

    expect(screen.getByLabelText('Loading chart')).toBeOnTheScreen();
    expect(screen.getByText('toolbar')).toBeOnTheScreen();
  });

  it('keeps the time axis oldest-left in Arabic, under the unmirrored plot', async () => {
    const t = Date.UTC(2026, 0, 5);
    const candle = { t, o: 1, h: 1, l: 1, c: 1, v: 1 };
    const { result } = await renderHook(() => useCopy(), {
      wrapper: ({ children }) => <Providers locale="ar">{children}</Providers>,
    });
    const label = result.current.f.chartTime(t, '1M');
    mockedHook.mockReturnValue(chart({ axisLabels: [candle] }));
    await renderScreen(<PriceChart symbol="AAPL" period="1M" type="area" onScrub={jest.fn()} />, {
      locale: 'ar',
    });

    expect(layoutDirection(screen.getByText(label))).toBe('ltr');
  });
});
