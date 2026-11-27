import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChangePill } from '../src/trading/change-pill';
import { ConnectionBadge } from '../src/trading/connection-badge';
import { PeriodTabs } from '../src/trading/period-tabs';
import { PriceFlash, PriceText } from '../src/trading/price';
import { StarButton } from '../src/trading/star-button';

const dollars = (price: number) => `$${price.toFixed(2)}`;

describe('PriceFlash', () => {
  it('flashes up or down depending on the previous price', () => {
    const { rerender } = render(<PriceFlash price={100} format={dollars} />);
    expect(screen.getByText('$100.00')).not.toHaveClass('animate-flash-up');

    rerender(<PriceFlash price={101} format={dollars} />);
    expect(screen.getByText('$101.00')).toHaveClass('animate-flash-up');

    rerender(<PriceFlash price={99.5} format={dollars} />);
    expect(screen.getByText('$99.50')).toHaveClass('animate-flash-down');
  });

  it("prints the caller's formatted price, so the locale and digits carry through", () => {
    render(<PriceText value={231.48} format={() => '$٢٣١٫٤٨'} />);
    expect(screen.getByText('$٢٣١٫٤٨')).toBeInTheDocument();
  });
});

describe('ChangePill', () => {
  it('shows an arrow so direction is not conveyed by colour alone', () => {
    render(<ChangePill value={-0.87} label="−0.87%" />);
    expect(screen.getByText('▼')).toBeInTheDocument();
    expect(screen.getByText('−0.87%')).toBeInTheDocument();
  });
});

describe('ChangePill inline variant', () => {
  it('drops the background for header use but keeps the arrow', () => {
    render(<ChangePill value={2.84} label="+2.84 (+1.24%)" variant="inline" />);
    expect(screen.getByText('▲ +2.84 (+1.24%)')).toHaveClass('text-pos');
  });
});

describe('StarButton', () => {
  it('announces its state and toggles', async () => {
    const onToggle = jest.fn();
    render(<StarButton label="Add AAPL to watchlist" watched={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Add AAPL to watchlist' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('ConnectionBadge', () => {
  it('describes the status in words', () => {
    render(<ConnectionBadge status="reconnecting" label="Reconnecting…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');
  });

  it('pads with logical start and end, so it mirrors in RTL', () => {
    render(<ConnectionBadge status="live" label="مباشر" />);
    const badge = screen.getByRole('status');

    expect(badge).toHaveClass('ps-conn-start', 'pe-2.5');
    expect(badge.className).not.toMatch(/\bp[lr]-/);
  });
});

describe('PeriodTabs', () => {
  it('selects with arrow keys and skips disabled periods', async () => {
    const onChange = jest.fn();
    render(
      <PeriodTabs
        value="1Y"
        onChange={onChange}
        enabled={['1D', '1W', '1M', '1Y']}
        label="فترة الرسم"
      />,
    );

    expect(screen.getByRole('tablist', { name: 'فترة الرسم' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ALL' })).toBeDisabled();
    screen.getByRole('tab', { name: '1Y' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('1D');
  });

  it('moves with the reading direction in RTL', async () => {
    const onChange = jest.fn();
    render(
      <div dir="rtl">
        <PeriodTabs value="1W" onChange={onChange} label="فترة الرسم" />
      </div>,
    );

    screen.getByRole('tab', { name: '1W' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('1M');
  });
});
