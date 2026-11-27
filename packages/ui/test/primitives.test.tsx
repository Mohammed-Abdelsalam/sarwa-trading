import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button, IconButton } from '../src/primitives/button';
import { Banner, StateView } from '../src/primitives/feedback';
import { Field, Input } from '../src/primitives/form';

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
      <Banner tone="brand" onDismiss={onDismiss}>
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
