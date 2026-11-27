import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type InviteView, InvitePage } from '../../src/features/invite/invite-page';
import { NOW, renderWithProviders } from '../utils';

function makeView(overrides: Partial<InviteView> = {}): InviteView {
  return {
    status: 'ready',
    info: {
      email: 'lee@minitrading.dev',
      role: 'VIEWER',
      expiresAt: new Date(NOW + 3_600_000).toISOString(),
    },
    name: '',
    password: '',
    showPassword: false,
    strength: 0,
    errors: {},
    limits: { nameMax: 80, passwordMin: 8, passwordMax: 128 },
    isSubmitting: false,
    failed: false,
    actions: {
      setName: jest.fn(),
      setPassword: jest.fn(),
      toggleShowPassword: jest.fn(),
      submit: jest.fn(),
    },
    ...overrides,
  };
}

describe('InvitePage', () => {
  it('asks the invitee for a name and password and scores the password', async () => {
    const view = makeView({ strength: 3 });
    renderWithProviders(<InvitePage view={view} />);

    expect(screen.getByRole('heading', { name: 'Join the admin team' })).toBeInTheDocument();
    expect(
      screen.getByText(/You were invited as VIEWER with lee@minitrading\.dev/),
    ).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Full name'), 'L');
    expect(view.actions.setName).toHaveBeenCalledWith('L');
    await userEvent.type(screen.getByLabelText('Password'), 'p');
    expect(view.actions.setPassword).toHaveBeenCalledWith('p');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(view.actions.toggleShowPassword).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Create admin account' }));
    expect(view.actions.submit).toHaveBeenCalled();
  });

  it('explains each field error with its limit', () => {
    renderWithProviders(
      <InvitePage
        view={makeView({ errors: { name: 'NAME_REQUIRED', password: 'PASSWORD_TOO_SHORT' } })}
      />,
    );

    expect(screen.getByLabelText('Full name')).toHaveAccessibleDescription('Enter your name');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'Use at least 8 characters',
    );
  });

  it('sends an expired or used link back to sign in', () => {
    renderWithProviders(<InvitePage view={makeView({ status: 'invalid', info: null })} />);

    expect(screen.getByText('This invite has expired')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
  });
});
