import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import { useAdminI18n } from '@sarwa/core/admin';

import RootLayout from '../../src/app/layout';
import { createBrowserClients } from '../../src/lib/client';
import { AppProviders } from '../../src/providers/app-providers';
import { testClients } from '../utils';

let cookieJar: Record<string, string> = {};

jest.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (name in cookieJar ? { value: cookieJar[name] } : undefined),
      has: (name: string) => name in cookieJar,
    }),
  headers: () => Promise.resolve(new Headers({ 'x-nonce': 'nonce-1' })),
}));
jest.mock('next/font/google', () => {
  const font = () => ({ variable: 'font' });
  return { Inter: font, JetBrains_Mono: font, Manrope: font };
});
jest.mock('../../src/lib/client', () => ({
  ...jest.requireActual<object>('../../src/lib/client'),
  createBrowserClients: jest.fn(),
}));

function AdminLabel() {
  return <span>{useAdminI18n().t.admin.shell.admin}</span>;
}

async function serverHtml() {
  return renderToString(await RootLayout({ children: <AdminLabel /> }));
}

beforeEach(() => {
  cookieJar = {};
  jest.mocked(createBrowserClients).mockReturnValue(testClients());
});

describe('RootLayout', () => {
  it('renders Arabic, right to left, from the language cookie', async () => {
    cookieJar = { 'sarwa.locale': 'ar' };

    const view = await serverHtml();

    expect(view).toContain('<html lang="ar" dir="rtl"');
    expect(view).toContain('الإدارة');
  });

  it('renders English without a cookie, leaving an older saved choice to the browser', async () => {
    const view = await serverHtml();

    expect(view).toContain('<html lang="en" dir="ltr"');
    expect(view).toContain('Admin');
  });
});

describe('AppProviders', () => {
  it('keeps the document language and direction in step with the chosen locale', () => {
    render(
      <AppProviders preferences={{ locale: 'ar', digits: 'latn' }}>
        <AdminLabel />
      </AppProviders>,
    );

    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});
