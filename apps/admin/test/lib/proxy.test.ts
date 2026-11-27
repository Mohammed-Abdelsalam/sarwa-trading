/**
 * @jest-environment node
 */
import { getRedirectUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';

import { ADMIN_SESSION_COOKIE } from '@sarwa/contracts';

import { config, proxy } from '../../src/proxy';

const request = (path: string, signedIn = false) =>
  new NextRequest(`https://admin.test${path}`, {
    headers: signedIn ? { cookie: `${ADMIN_SESSION_COOKIE}=token` } : {},
  });

describe('proxy', () => {
  it('runs on pages, including /login, but not on assets or API routes', () => {
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

    expect(matches('/overview')).toBe(true);
    expect(matches('/login')).toBe(true);
    expect(matches('/login-help')).toBe(true);
    expect(matches('/icons')).toBe(true);
    expect(matches('/_next/static/chunk.js')).toBe(false);
    expect(matches('/favicon.ico')).toBe(false);
    expect(matches('/robots.txt')).toBe(false);
    expect(matches('/icon.png')).toBe(false);
    expect(matches('/api/admin/me')).toBe(false);
    expect(matches('/socket.io/')).toBe(false);
  });

  it('sends signed-out visitors to login with the page they wanted', () => {
    expect(getRedirectUrl(proxy(request('/orders?status=open')))).toBe(
      'https://admin.test/login?next=%2Forders%3Fstatus%3Dopen',
    );
    expect(getRedirectUrl(proxy(request('/login')))).toBeNull();
  });

  it('sends a signed-in admin away from the login page', () => {
    expect(getRedirectUrl(proxy(request('/login', true)))).toBe('https://admin.test/overview');
    expect(getRedirectUrl(proxy(request('/trading', true)))).toBeNull();
    expect(getRedirectUrl(proxy(request('/login?next=%2Forders', true)))).toBeNull();
  });
});
