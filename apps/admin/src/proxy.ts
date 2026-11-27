import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE } from '@sarwa/contracts';

// An optimistic check only: no cookie means no session. The API still verifies every request.
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has(ADMIN_SESSION_COOKIE);
  const { pathname, search, searchParams } = request.nextUrl;
  if (pathname === '/login') {
    // A ?next= means the API just rejected this cookie, so bouncing back would loop.
    return signedIn && !searchParams.has('next')
      ? NextResponse.redirect(new URL('/overview', request.url))
      : NextResponse.next();
  }
  if (signedIn) return NextResponse.next();
  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|socket\\.io(?:/|$)|_next/|favicon\\.ico$|robots\\.txt$|(?:apple-)?icon\\d*\\.\\w+$).*)',
  ],
};
