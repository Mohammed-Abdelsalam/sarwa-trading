import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EstimateRows, StatTile, Timeline } from '../src/primitives/data';
import { Callout, CountBadge, CountdownBar, ProgressBar } from '../src/primitives/feedback';
import { Input, Switch } from '../src/primitives/form';
import { Kbd } from '../src/primitives/navigation';
import { SortHeader, Table, TBody, TCell, THead, TRow } from '../src/primitives/table';

describe('Callout', () => {
  it('only interrupts screen readers when urgent', () => {
    const { rerender } = render(
      <Callout tone="info" title="Rests on the book">
        It can fill partially.
      </Callout>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Rests on the book')).toBeInTheDocument();

    rerender(
      <Callout tone="neg" urgent action={<button type="button">Retry</button>}>
        Order rejected
      </Callout>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Order rejected');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('EstimateRows', () => {
  it('lists label/value pairs with hints and an emphasized total', () => {
    render(
      <EstimateRows
        rows={[
          { label: 'Est. cost', value: '$2,290.00', hint: 'At your limit price' },
          { label: 'Est. fees', value: '$0.00' },
        ]}
        total={{ label: 'After order', value: '$55,880.12' }}
      />,
    );
    expect(screen.getAllByRole('definition')[0]).toHaveTextContent('$2,290.00');
    expect(screen.getByText('At your limit price')).toBeInTheDocument();
    expect(screen.getByText('After order')).toHaveClass('font-semibold');
  });
});

describe('ProgressBar', () => {
  it('exposes its value as a percentage with a label', () => {
    render(<ProgressBar value={8 / 15} label="Filled" valueText="8 of 15 shares" />);
    const bar = screen.getByRole('progressbar', { name: 'Filled' });
    expect(bar).toHaveValue(53);
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuetext', '8 of 15 shares');
  });

  it('clamps the countdown to its range', () => {
    render(<CountdownBar remaining={1.4} label="Quote valid" />);
    expect(screen.getByRole('progressbar', { name: 'Quote valid' })).toHaveValue(100);
  });
});

describe('CountBadge', () => {
  it('caps the count at 9+ and hides when nothing is unread', () => {
    const { rerender, container } = render(<CountBadge count={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();

    rerender(<CountBadge count={12} />);
    expect(screen.getByText('9+')).toBeInTheDocument();

    rerender(<CountBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Timeline', () => {
  it('marks the current step and can announce each state', () => {
    render(
      <Timeline
        stateLabels={{ done: 'done', now: 'in progress', todo: 'pending' }}
        steps={[
          { title: 'Placed', meta: '11:38:02 AM', state: 'done' },
          { title: 'Working · 7 remaining', state: 'now' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).toHaveTextContent('Placed, done');
  });
});

describe('SortHeader', () => {
  it('reports the sort direction on the column header and sorts on click', async () => {
    const onSort = jest.fn();
    render(
      <Table>
        <THead>
          <tr>
            <SortHeader label="Notional" direction="descending" onSort={onSort} align="end" />
          </tr>
        </THead>
        <TBody>
          <TRow>
            <TCell align="end">$1,000.00</TCell>
          </TRow>
        </TBody>
      </Table>,
    );
    expect(screen.getByRole('columnheader', { name: 'Notional' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Notional' }));
    expect(onSort).toHaveBeenCalledTimes(1);
  });
});

describe('Table', () => {
  it('scrolls sideways inside a focusable region named after the table', () => {
    render(
      <Table label="Accounts">
        <TBody>
          <TRow>
            <TCell>ACC-1</TCell>
          </TRow>
        </TBody>
      </Table>,
    );
    const region = screen.getByRole('region', { name: 'Accounts' });
    expect(region).toHaveClass('overflow-x-auto');
    expect(region).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('table', { name: 'Accounts' })).toBeInTheDocument();
  });

  it('adds no unnamed tab stop when the table has no label', async () => {
    render(
      <Table>
        <TBody />
      </Table>,
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    await userEvent.tab();
    expect(document.body).toHaveFocus();
  });
});

describe('Input affixes', () => {
  it('renders a prefix and a suffix around the field', () => {
    render(<Input aria-label="Max slippage" prefix="$" suffix="%" defaultValue="0.5" />);
    expect(screen.getByRole('textbox', { name: 'Max slippage' })).toHaveClass('ps-7', 'pe-8');
    expect(screen.getByText('$')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });
});

describe('Switch', () => {
  it('toggles as a labelled switch', async () => {
    const onCheckedChange = jest.fn();
    render(<Switch aria-label="Trading enabled" checked onCheckedChange={onCheckedChange} />);
    const toggle = screen.getByRole('switch', { name: 'Trading enabled' });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });
});

describe('Kbd', () => {
  it('has an inverse look for use on a primary button', () => {
    render(<Kbd variant="inverse">↵</Kbd>);
    expect(screen.getByText('↵')).toHaveClass('text-on-brand');
  });
});

describe('StatTile', () => {
  it('shows the label, value and a toned delta', () => {
    render(
      <StatTile
        label="Orders today"
        value="1,284"
        delta="+12%"
        deltaTone="pos"
        caption="vs yesterday"
      />,
    );
    expect(screen.getByText('1,284')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toHaveClass('text-pos');
  });
});
