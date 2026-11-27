import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SignUpPage } from '../../../src/features/auth/sign-up-page';
import { providers } from '../../copy';
import { signUpView } from './auth-fixtures';

function renderPage(view = signUpView(), locale?: 'en' | 'ar') {
  return render(<SignUpPage view={view} />, { wrapper: providers({ locale }).wrapper });
}

describe('SignUpPage', () => {
  it('shows the card, the strength meter and coming-soon providers', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();
    expect(screen.getByText('Practice trading US stocks with $100,000 virtual cash')).toBeVisible();
    expect(screen.getByRole('meter', { name: 'Strength' })).toHaveAttribute(
      'aria-valuetext',
      'Good',
    );
    expect(screen.getByText('Tip: add a number or symbol')).toHaveAttribute('data-ok', 'false');
    expect(
      screen.getByRole('button', { name: 'Continue with Google — coming soon' }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
  });

  it('walks the fields in visual order, show/hide included', async () => {
    renderPage();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Back to markets' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('checkbox')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Create account' })).toHaveFocus();
    await userEvent.tab();
    expect(
      screen.getByRole('button', { name: 'Continue with Google — coming soon' }),
    ).toHaveFocus();
  });

  it('marks each invalid field and points it at its message', () => {
    renderPage(
      signUpView({
        values: { name: '', email: 'sara.h@example', password: 'password1', terms: false },
        password: {
          strength: 1,
          minLength: 8,
          longEnough: true,
          notCommon: false,
          hasNumberOrSymbol: true,
        },
        errors: {
          name: { code: 'NAME_REQUIRED' },
          email: { code: 'EMAIL_INVALID' },
          password: { code: 'PASSWORD_COMMON' },
          terms: { code: 'TERMS_REQUIRED' },
        },
      }),
    );
    const name = screen.getByLabelText('Name');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Enter your name');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Enter a full email address, e.g. name@example.com',
    );
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'This password is too common — try a longer phrase',
    );
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription(
      'Accept the terms to continue',
    );
    expect(screen.getByRole('meter', { name: 'Strength' })).toHaveAttribute(
      'aria-valuetext',
      'Weak',
    );
    expect(screen.getByText('Not a common password')).toHaveAttribute('data-ok', 'false');
  });

  it('names the limit in a length error', () => {
    renderPage(signUpView({ errors: { password: { code: 'PASSWORD_TOO_SHORT', n: 8 } } }));
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'Use at least 8 characters',
    );
  });

  it('forwards typing, the terms box and submit to the view', async () => {
    const view = signUpView({
      values: { name: '', email: '', password: '', terms: false },
      password: {
        strength: 0,
        minLength: 8,
        longEnough: false,
        notCommon: true,
        hasNumberOrSymbol: false,
      },
    });
    renderPage(view);
    await userEvent.type(screen.getByLabelText('Name'), 'S');
    await userEvent.type(screen.getByLabelText('Email'), 's');
    await userEvent.type(screen.getByLabelText('Password'), 'p');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(view.actions.setName).toHaveBeenCalledWith('S');
    expect(view.actions.setEmail).toHaveBeenCalledWith('s');
    expect(view.actions.setPassword).toHaveBeenCalledWith('p');
    expect(view.actions.setTerms).toHaveBeenCalledWith(true);
    expect(view.actions.submit).toHaveBeenCalledTimes(1);
  });

  it('focuses an email-in-use banner that offers sign in', () => {
    renderPage(signUpView({ problem: 'EMAIL_IN_USE' }));
    const banner = screen.getByRole('alert');
    expect(banner).toHaveFocus();
    expect(banner).toHaveTextContent('An account with this email already exists. Sign in instead?');
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/signin');
  });

  it('shows a busy button while creating the account', () => {
    renderPage(signUpView({ isPending: true }));
    expect(screen.getByRole('button', { name: 'Creating account…' })).toBeDisabled();
    expect(screen.getByLabelText('Name')).toBeDisabled();
  });

  it('reads in Arabic', () => {
    renderPage(signUpView(), 'ar');
    expect(screen.getByRole('button', { name: 'إنشاء حساب' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'العودة إلى الأسواق' })).toBeVisible();
  });
});
