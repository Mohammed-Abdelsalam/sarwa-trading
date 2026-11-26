import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button, IconButton } from '../src/primitives/button';
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
