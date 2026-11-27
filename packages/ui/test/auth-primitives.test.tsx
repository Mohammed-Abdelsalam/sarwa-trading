import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Dialog } from '../src/primitives/dialog';
import { Field, PasswordInput, PasswordStrengthMeter } from '../src/primitives/form';

describe('PasswordInput', () => {
  it('toggles visibility with a pressed-state button that keeps its own tab stop', async () => {
    render(
      <Field label="Password">
        {(field) => (
          <PasswordInput {...field} showLabel="Show password" hideLabel="Hide password" />
        )}
      </Field>,
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    input.focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveFocus();
  });
});

describe('PasswordStrengthMeter', () => {
  it('exposes the level as a meter and lists each rule', () => {
    render(
      <PasswordStrengthMeter
        strength={3}
        label="Strength"
        levelLabel="Good"
        rules={[
          { label: 'At least 8 characters', ok: true },
          { label: 'Tip: add a number or symbol', ok: false },
        ]}
      />,
    );
    const meter = screen.getByRole('meter', { name: 'Strength' });
    expect(meter).toHaveAttribute('aria-valuetext', 'Good');
    expect(screen.getByText('At least 8 characters')).toHaveAttribute('data-ok', 'true');
    expect(screen.getByText('Tip: add a number or symbol')).toHaveAttribute('data-ok', 'false');
  });
});

describe('Dialog', () => {
  it('can start on its title and closes from a labelled button', async () => {
    const onOpenChange = jest.fn();
    render(
      <Dialog
        open
        onOpenChange={onOpenChange}
        title="Create an account to buy AAPL"
        closeLabel="Close"
        focusTitle
      >
        <input aria-label="Name" />
      </Dialog>,
    );
    expect(screen.getByRole('heading', { name: 'Create an account to buy AAPL' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
