import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ChangePill,
  ConnectionBadge,
  PeriodTabs,
  PriceFlash,
  sparklinePath,
  StarButton,
} from './trading';

describe('PriceFlash', () => {
  it('flashes up or down depending on the previous price', () => {
    const { rerender } = render(<PriceFlash price={100} />);
    expect(screen.getByText('$100.00')).not.toHaveClass('animate-flash-up');

    rerender(<PriceFlash price={101} />);
    expect(screen.getByText('$101.00')).toHaveClass('animate-flash-up');

    rerender(<PriceFlash price={99.5} />);
    expect(screen.getByText('$99.50')).toHaveClass('animate-flash-down');
  });
});

describe('ChangePill', () => {
  it('shows an arrow so direction is not conveyed by colour alone', () => {
    render(<ChangePill value={-0.87} label="−0.87%" />);
    expect(screen.getByText('▼')).toBeInTheDocument();
    expect(screen.getByText('−0.87%')).toBeInTheDocument();
  });
});

describe('StarButton', () => {
  it('announces its state and toggles', async () => {
    const onToggle = jest.fn();
    render(<StarButton symbol="AAPL" watched={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Add AAPL to watchlist' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('ConnectionBadge', () => {
  it('describes the status in words', () => {
    render(<ConnectionBadge status="reconnecting" />);
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');
  });
});

describe('PeriodTabs', () => {
  it('selects with arrow keys and skips disabled periods', async () => {
    const onChange = jest.fn();
    render(<PeriodTabs value="1Y" onChange={onChange} enabled={['1D', '1W', '1M', '1Y']} />);

    expect(screen.getByRole('tab', { name: 'ALL' })).toBeDisabled();
    screen.getByRole('tab', { name: '1Y' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('1D');
  });
});

describe('sparklinePath', () => {
  it('draws one point per value across the full width', () => {
    expect(sparklinePath([1, 2, 3], 60, 26)).toBe('M0.0 24.0L30.0 13.0L60.0 2.0');
  });

  it('returns an empty path when there is not enough data', () => {
    expect(sparklinePath([1], 60, 26)).toBe('');
  });
});
