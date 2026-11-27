import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MarketStatusPill } from '../src/trading/market-status';
import { AllocationBar, Heatmap } from '../src/trading/portfolio-charts';
import { SideToggle } from '../src/trading/side-toggle';
import { StatusBadge } from '../src/trading/status-badge';

describe('SideToggle', () => {
  it('is a radio group that flips side with arrow keys and shows the sell suffix', async () => {
    const onChange = jest.fn();
    render(
      <SideToggle
        label="Side"
        buyLabel="Buy"
        sellLabel="Sell"
        sellSuffix="42 sh"
        value="buy"
        onChange={onChange}
      />,
    );
    const buy = screen.getByRole('radio', { name: 'Buy' });
    expect(buy).toBeChecked();
    expect(buy).toHaveClass('bg-brand', 'text-on-brand');
    expect(screen.getByRole('radio', { name: 'Sell · 42 sh' })).not.toBeChecked();

    buy.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('sell');
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('uses the inverse neutral fill for sell, never red', () => {
    render(
      <SideToggle label="Side" buyLabel="Buy" sellLabel="Sell" value="sell" onChange={jest.fn()} />,
    );
    const sell = screen.getByRole('radio', { name: 'Sell' });
    expect(sell).toHaveClass('bg-fg', 'text-bg');
    expect(sell.className).not.toMatch(/neg|danger|pos/);
  });
});

describe('StatusBadge', () => {
  it('maps order and alert statuses to badge tones', () => {
    render(
      <>
        <StatusBadge status="queued" label="Queued for open" />
        <StatusBadge status="open" label="Open" />
        <StatusBadge status="partially_filled" label="Partially filled" />
        <StatusBadge status="filled" label="Filled" />
        <StatusBadge status="rejected" label="Rejected" />
        <StatusBadge status="sending" label="Sending…" />
        <StatusBadge status="triggered" label="Triggered" />
        <StatusBadge status="active" label="Active" />
        <StatusBadge status="paused" label="Paused" />
      </>,
    );
    expect(screen.getByText('Queued for open')).toHaveClass('bg-brand-subtle');
    expect(screen.getByText('Open')).toHaveClass('bg-info-subtle');
    expect(screen.getByText('Partially filled')).toHaveClass('bg-warn-subtle');
    expect(screen.getByText('Filled')).toHaveClass('bg-pos-subtle');
    expect(screen.getByText('Rejected')).toHaveClass('bg-neg-subtle');
    expect(screen.getByText('Sending…')).toHaveClass('border-border-strong');
    expect(screen.getByText('Triggered')).toHaveClass('bg-brand-subtle');
    expect(screen.getByText('Active')).toHaveClass('bg-pos-subtle');
    expect(screen.getByText('Paused')).toHaveClass('bg-flat-subtle');
  });

  it('rejects an unknown status at compile time instead of falling back to neutral', () => {
    // @ts-expect-error a typo is not a status
    const typo = <StatusBadge status="filed" label="Filled" />;
    expect(typo.props).toMatchObject({ status: 'filed' });
  });
});

describe('Heatmap', () => {
  it('always prints the move on each tile so it reads without colour', () => {
    render(
      <Heatmap
        label="Sector heatmap"
        tiles={[
          { key: 'NVDA', label: 'NVDA', change: 3.41, changeLabel: '+3.41%', weight: 0.2 },
          { key: 'TSLA', label: 'TSLA', change: -1.8, changeLabel: '−1.80%', weight: 0.05 },
          { key: 'KO', label: 'KO', change: 0, changeLabel: '0.00%', weight: 0.02 },
        ]}
      />,
    );
    const items = within(screen.getByRole('list', { name: 'Sector heatmap' })).getAllByRole(
      'listitem',
    );
    expect(items.map((item) => item.textContent)).toEqual([
      'NVDA▲ +3.41%',
      'TSLA▼ −1.80%',
      'KO■ 0.00%',
    ]);
    expect(items[0]).toHaveClass('col-span-2', 'bg-pos/50');
    expect(items[1]).toHaveClass('bg-neg/35');
    expect(items[2]).toHaveClass('bg-flat-subtle');
  });
});

describe('AllocationBar', () => {
  it('offers the segments as a labelled list even when the legend is hidden', () => {
    render(
      <AllocationBar
        label="Allocation"
        legend={false}
        segments={[
          {
            key: 'tech',
            label: 'Technology',
            value: '$41,200.00',
            weight: 0.412,
            colorRole: 'tech',
          },
          { key: 'cash', label: 'Cash', value: '$12,000.00', weight: 0.12, colorRole: 'cash' },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: 'Allocation' });
    expect(list).toHaveClass('sr-only');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Technology$41,200.0041.2%');
  });
});

describe('MarketStatusPill', () => {
  it('announces the passed label with its state', () => {
    render(<MarketStatusPill state="closed" label="Closed · opens 9:30 AM" />);
    const pill = screen.getByRole('status');
    expect(pill).toHaveTextContent('Closed · opens 9:30 AM');
    expect(pill).toHaveAttribute('data-state', 'closed');
  });
});
