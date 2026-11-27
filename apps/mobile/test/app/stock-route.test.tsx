import { render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import StockRoute from '../../src/app/stocks/[symbol]';

import type { Text } from 'react-native';

jest.mock('expo-router', () => ({ useLocalSearchParams: jest.fn() }));
jest.mock('../../src/features/stock-detail/stock-detail-screen', () => {
  const { Text: MockText } = jest.requireActual<{ Text: typeof Text }>('react-native');
  return {
    StockDetailScreen: ({ symbol }: { symbol: string }) => <MockText>{`stock:${symbol}`}</MockText>,
  };
});
jest.mock('../../src/components/layout/route-fallbacks', () => {
  const { Text: MockText } = jest.requireActual<{ Text: typeof Text }>('react-native');
  return { NotFoundScreen: () => <MockText>not-found</MockText> };
});

const params = jest.mocked(useLocalSearchParams);

describe('StockRoute', () => {
  it('opens the stock named in the link', async () => {
    params.mockReturnValue({ symbol: 'msft' });
    await render(<StockRoute />);

    expect(screen.getByText('stock:MSFT')).toBeOnTheScreen();
  });

  it('shows not found for a malformed symbol instead of querying the API with it', async () => {
    params.mockReturnValue({ symbol: '<script>' });
    await render(<StockRoute />);

    expect(screen.getByText('not-found')).toBeOnTheScreen();
  });
});
