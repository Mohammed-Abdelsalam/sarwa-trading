import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoginPage } from '../../src/features/login/login-page';
import { type ApiCall, HttpError, makeUser, renderWithApi, type Routes } from '../utils';

const logins = (calls: ApiCall[]) => calls.filter((call) => call.path === 'admin/auth/login');

function setup(reply: Routes[string] = { user: makeUser() }) {
  return renderWithApi(<LoginPage />, {
    'POST admin/auth/login': reply,
    'GET stocks': { items: [] },
  });
}

async function signIn(password = 'hunter2-but-longer') {
  await userEvent.type(screen.getByLabelText('Email'), 'maya@minitrading.dev');
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginPage', () => {
  it('validates both fields before calling the API', async () => {
    const { calls } = setup();

    await userEvent.type(screen.getByLabelText('Email'), 'maya@');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(logins(calls)).toEqual([]);
  });

  it('signs in with remember-me off by default and lets the operator turn it on', async () => {
    const { calls } = setup(new HttpError(401));

    await userEvent.type(screen.getByLabelText('Email'), ' maya@minitrading.dev ');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter2-but-longer');
    const remember = screen.getByRole('checkbox', { name: 'Keep me signed in for 7 days' });
    expect(remember).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(logins(calls).map((call) => call.body)).toEqual([
        { email: 'maya@minitrading.dev', password: 'hunter2-but-longer', remember: false },
      ]);
    });

    await userEvent.click(remember);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(logins(calls).at(-1)?.body).toEqual(expect.objectContaining({ remember: true }));
    });
  });

  it('explains a wrong password without saying which field was wrong', async () => {
    setup(new HttpError(401));

    await signIn();
    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('2 attempts left before a 60-second cooldown.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('blocks submits during the cooldown the server asks for', async () => {
    const { calls } = setup(new HttpError(429));

    await signIn();

    expect(await screen.findByText(/^Try again in \d+ s\.$/)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Sign in' });
    expect(submit).toBeDisabled();
    await userEvent.click(submit);
    expect(logins(calls)).toHaveLength(1);
  });

  it('shows the loading state while the sign-in is in flight', async () => {
    setup(() => new Promise(() => undefined));

    await signIn();

    expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled();
  });

  it('shows and hides the password', async () => {
    setup();

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });
});
