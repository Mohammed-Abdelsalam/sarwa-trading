import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button, IconButton } from '../src/primitives/button';
import { Chip, SegmentedControl } from '../src/primitives/controls';
import { Banner, StateView, Toast } from '../src/primitives/feedback';
import { Field, Input, Select } from '../src/primitives/form';
import { Breadcrumbs } from '../src/primitives/navigation';

describe('Button', () => {
  it('calls onClick when pressed', async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Save changes</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and busy while loading', () => {
    render(<Button loading>Saving…</Button>);
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('renders its child element when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/markets">Browse markets</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Browse markets' })).toHaveAttribute(
      'href',
      '/markets',
    );
  });
});

describe('Button icon', () => {
  it('renders the icon before the label and swaps it for a spinner while loading', () => {
    const { rerender } = render(<Button icon={<svg data-testid="icon" />}>Retry</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();

    rerender(
      <Button icon={<svg data-testid="icon" />} loading>
        Retry
      </Button>,
    );
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
  });
});

describe('Banner', () => {
  it('offers a dismiss button only when it can be dismissed', async () => {
    const onDismiss = jest.fn();
    const { rerender } = render(<Banner tone="warn">Reconnecting…</Banner>);
    expect(screen.queryByRole('button', { name: 'Dismiss message' })).not.toBeInTheDocument();

    rerender(
      <Banner tone="brand" onDismiss={onDismiss} dismissLabel="Dismiss message">
        Markets close early today
      </Banner>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('StateView', () => {
  it('shows the footnote under the action', () => {
    render(
      <StateView
        icon={<svg />}
        title="We'll be right back"
        footnote="We'll also retry automatically every 30 s."
      />,
    );
    expect(screen.getByText("We'll also retry automatically every 30 s.")).toBeInTheDocument();
  });
});

describe('IconButton', () => {
  it('uses its label as the accessible name', () => {
    render(<IconButton label="Collapse sidebar">×</IconButton>);
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  });
});

describe('Field', () => {
  it('links the label and the error message to the input', () => {
    render(
      <Field label="Base price" error="Must be > 0">
        {(props) => <Input {...props} />}
      </Field>,
    );
    const input = screen.getByLabelText('Base price');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Must be > 0');
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'area', label: 'Area' },
    { value: 'candle', label: 'Candlestick' },
  ] as const;

  it('is a radio group that changes on click and with arrow keys', async () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl label="Chart type" options={options} value="area" onChange={onChange} />,
    );
    expect(screen.getByRole('radio', { name: 'Area' })).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: 'Candlestick' }));
    expect(onChange).toHaveBeenLastCalledWith('candle');

    screen.getByRole('radio', { name: 'Area' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('candle');
  });

  it('ignores clicks and keys while disabled', async () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        label="Chart type"
        options={options}
        value="area"
        onChange={onChange}
        disabled
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Candlestick' }));
    screen.getByRole('radio', { name: 'Area' }).focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Area' })).toBeDisabled();
  });
});

describe('Chip', () => {
  it('passes through role and state for tab-like filters', () => {
    render(
      <Chip role="tab" aria-selected active>
        All
      </Chip>,
    );
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Breadcrumbs', () => {
  it('links every level but the current page', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'Markets', href: '/' },
          { label: 'Technology', href: '/' },
          { label: 'AAPL' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Markets' })).toHaveAttribute('href', '/');
    expect(screen.getByText('AAPL')).toHaveAttribute('aria-current', 'page');
  });
});

describe('Toast', () => {
  it('shows the message with its action and can be dismissed', async () => {
    const onDismiss = jest.fn();
    render(
      <Toast
        title="KO removed from Watchlist"
        action={<button type="button">Undo</button>}
        onDismiss={onDismiss}
        dismissLabel="Dismiss"
      />,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('Select', () => {
  it('is a labelled native select that reports its error', async () => {
    const onChange = jest.fn();
    render(
      <Field label="Sector" error="Required">
        {(props) => (
          <Select {...props} value="" onChange={onChange}>
            <option value="">Select sector</option>
            <option value="tech">Technology</option>
          </Select>
        )}
      </Field>,
    );

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sector' }), 'tech');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('combobox', { name: 'Sector' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
