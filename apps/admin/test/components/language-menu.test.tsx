import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoginPage } from '../../src/features/login/login-page';
import { preferenceStorage } from '../../src/lib/client';
import { renderWithApi } from '../utils';

afterEach(() => {
  document.cookie = 'sarwa.locale=; max-age=0';
  window.localStorage.clear();
});

describe('Language menu', () => {
  it('switches the login page to Arabic and saves the choice in the cookie the server reads', async () => {
    renderWithApi(<LoginPage />, { 'GET stocks': { items: [] } }, { storage: preferenceStorage });

    await userEvent.click(screen.getByRole('button', { name: 'Language' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'العربية' }));

    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    expect(document.cookie).toContain('sarwa.locale=ar');
    expect(window.localStorage.getItem('sarwa.locale')).toBe('ar');
  });

  it('carries a choice saved before the cookie existed over to the cookie', async () => {
    window.localStorage.setItem('sarwa.locale', 'ar');

    renderWithApi(<LoginPage />, { 'GET stocks': { items: [] } }, { storage: preferenceStorage });

    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    expect(document.cookie).toContain('sarwa.locale=ar');
  });
});
