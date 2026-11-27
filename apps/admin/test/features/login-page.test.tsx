import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useLogin } from '@sarwa/core/admin';

import { LoginPage } from '../../src/features/login/login-page';
import { renderWithProviders } from '../utils';

jest.mock('@sarwa/core/admin', () => ({
  ...jest.requireActual<object>('@sarwa/core/admin'),
  useLogin: jest.fn(),
  useLiveTicker: () => ({ rows: [], isLoading: false }),
}));

const mockedLogin = jest.mocked(useLogin);

function login(overrides: Partial<ReturnType<typeof useLogin>> = {}) {
  const model = {
    submit: jest.fn(),
    isPending: false,
    error: null,
    attemptsLeft: 5,
    cooldownSeconds: 0,
    ...overrides,
  };
  mockedLogin.mockReturnValue(model);
  return model;
}

describe('LoginPage', () => {
  it('validates both fields before calling the API', async () => {
    const model = login();
    renderWithProviders(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Email'), 'maya@');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(model.submit).not.toHaveBeenCalled();
  });

  it('signs in with remember-me off by default and lets the operator turn it on', async () => {
    const model = login();
    renderWithProviders(<LoginPage />);

    await userEvent.type(screen.getByLabelText('Email'), ' maya@minitrading.dev ');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter2-but-longer');
    const remember = screen.getByRole('checkbox', { name: 'Keep me signed in for 7 days' });
    expect(remember).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(model.submit).toHaveBeenLastCalledWith({
      email: 'maya@minitrading.dev',
      password: 'hunter2-but-longer',
      remember: false,
    });

    await userEvent.click(remember);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(model.submit).toHaveBeenLastCalledWith(expect.objectContaining({ remember: true }));
  });

  it('explains a wrong password without saying which field was wrong', () => {
    login({ error: 'invalid', attemptsLeft: 2 });
    renderWithProviders(<LoginPage />);

    expect(screen.getByText('Email or password is incorrect.')).toBeInTheDocument();
    expect(screen.getByText('2 attempts left before a 60-second cooldown.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('blocks submits during the cooldown and shows the loading state', () => {
    login({ error: 'cooldown', cooldownSeconds: 42 });
    const { unmount } = renderWithProviders(<LoginPage />);

    expect(screen.getByText('Try again in 42 s.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    unmount();

    login({ isPending: true });
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
  });

  it('shows and hides the password', async () => {
    login();
    renderWithProviders(<LoginPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });
});
