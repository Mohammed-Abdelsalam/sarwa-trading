import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { ChangePill } from '../../src/components/trading/change';
import { ConnectionBadge } from '../../src/components/trading/connection-badge';
import { PeriodTabs } from '../../src/components/trading/period-tabs';
import { StarButton } from '../../src/components/trading/star-button';
import { StockListSkeleton } from '../../src/components/trading/stock-row';

jest.mock('expo-router', () => ({ Link: () => null }));

describe('StarButton', () => {
  it('announces the action and gives haptic feedback only when adding', async () => {
    const onToggle = jest.fn();
    const { rerender } = await render(
      <StarButton symbol="AAPL" watched={false} onToggle={onToggle} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Add AAPL to watchlist' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

    await rerender(<StarButton symbol="AAPL" watched onToggle={onToggle} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove AAPL from watchlist' }));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });
});

describe('ChangePill', () => {
  it('pairs the colour with an arrow', async () => {
    await render(<ChangePill value={1.24} label="+1.24%" />);
    expect(screen.getByText('▲')).toBeOnTheScreen();
    expect(screen.getByText('+1.24%')).toBeOnTheScreen();
  });
});

describe('ConnectionBadge', () => {
  it('describes the connection in words', async () => {
    await render(<ConnectionBadge status="paused" />);
    expect(screen.getByLabelText('Market paused')).toBeOnTheScreen();
  });
});

describe('PeriodTabs', () => {
  it('disables periods turned off in the admin config', async () => {
    const onChange = jest.fn();
    await render(<PeriodTabs value="1D" onChange={onChange} enabled={['1D', '1W']} />);

    expect(screen.getByRole('tab', { name: 'ALL' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('tab', { name: '1W' }));
    expect(onChange).toHaveBeenCalledWith('1W');
  });
});

describe('StockListSkeleton', () => {
  it('announces one "Loading stocks" element with the requested number of rows', async () => {
    await render(<StockListSkeleton rows={4} />);

    expect(screen.getAllByLabelText('Loading stocks')).toHaveLength(1);
    expect(screen.getByRole('progressbar', { name: 'Loading stocks' })).toBeOnTheScreen();
    expect(screen.getAllByTestId('stock-row-skeleton')).toHaveLength(4);
  });
});
