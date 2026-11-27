import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE } from '@sarwa/contracts';

// An optimistic check only: no cookie means no session. The API still verifies every request.
export function proxy(request: NextRequest) {
  if (request.cookies.has(ADMIN_SESSION_COOKIE)) return NextResponse.next();
  const login = new URL('/login', request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!login|api|socket\\.io|_next|favicon\\.ico|icon).*)'],
};
