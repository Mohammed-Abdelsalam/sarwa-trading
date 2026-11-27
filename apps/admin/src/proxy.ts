import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE } from '@sarwa/contracts';
import { contentSecurityPolicy } from '@sarwa/ui/next-config';

// An optimistic check only: no cookie means no session. The API still verifies every request.
function route(request: NextRequest, headers: Headers): NextResponse {
  const next = () => NextResponse.next({ request: { headers } });
  const signedIn = request.cookies.has(ADMIN_SESSION_COOKIE);
  const { pathname, search, searchParams } = request.nextUrl;
  // Invite links are how a new admin gets an account, so they never need one.
  if (pathname.startsWith('/invite/')) return next();
  if (pathname === '/login') {
    // A ?next= means the API just rejected this cookie, so bouncing back would loop.
    return signedIn && !searchParams.has('next')
      ? NextResponse.redirect(new URL('/overview', request.url))
      : next();
  }
  if (signedIn) return next();
  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

// A fresh nonce per request: Next stamps it on its own scripts, the root layout on the theme script.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy({
    nonce,
    dev: process.env.NODE_ENV === 'development',
    https: request.nextUrl.protocol === 'https:',
  });
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = route(request, headers);
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|socket\\.io(?:/|$)|_next/|favicon\\.ico$|robots\\.txt$|(?:apple-)?icon\\d*\\.\\w+$).*)',
  ],
};
