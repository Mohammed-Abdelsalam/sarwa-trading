import { ForbiddenException } from '@nestjs/common';
import { type CookieOptions, type Request, type Response } from 'express';

import {
  AUTH_TTL_MS,
  CLIENT_PLATFORM_HEADER,
  type ClientPlatform,
  ClientPlatformSchema,
  CSRF_COOKIE,
  CSRF_HEADER,
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  CUSTOMER_REFRESH_COOKIE_PATH,
  DEVICE_ID_HEADER,
  ErrorCode,
} from '@sarwa/contracts';

import { isCrossSite } from '../common/same-origin.guard';
import { env } from '../env';
import { newSecret } from './secrets';
import { type ClientContext, type IssuedSession } from './sessions.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const BEARER = /^Bearer\s+(\S+)$/i;

const cookies = (request: Request) => request.cookies as Record<string, string | undefined>;

const base = (): CookieOptions => ({
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
});

export function platformOf(request: Request): ClientPlatform {
  const parsed = ClientPlatformSchema.safeParse(request.header(CLIENT_PLATFORM_HEADER));
  return parsed.success ? parsed.data : 'web';
}

// The apps keep their tokens in SecureStore and send a bearer token; the web uses cookies.
export const usesBearer = (request: Request): boolean =>
  BEARER.test(request.header('authorization') ?? '');

export function accessTokenOf(request: Request): string | undefined {
  const bearer = BEARER.exec(request.header('authorization') ?? '')?.[1];
  return bearer ?? cookies(request)[CUSTOMER_ACCESS_COOKIE];
}

export const refreshCookieOf = (request: Request): string | undefined =>
  cookies(request)[CUSTOMER_REFRESH_COOKIE];

export function deviceIdOf(request: Request): string | undefined {
  const value = request.header(DEVICE_ID_HEADER);
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value.toLowerCase() : undefined;
}

export function clientOf(request: Request, deviceModel?: string): ClientContext {
  return {
    platform: platformOf(request),
    ip: request.ip,
    userAgent: request.header('user-agent'),
    deviceModel,
  };
}

// A write made with the session cookie must come from our own pages: same origin, and the header
// copy of the readable CSRF cookie that another site can't read.
export function assertCookieWriteAllowed(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;
  const csrf = cookies(request)[CSRF_COOKIE];
  if (isCrossSite(request) || !csrf || request.header(CSRF_HEADER) !== csrf) {
    throw new ForbiddenException({
      code: ErrorCode.CsrfFailed,
      message: 'Refresh the page and try again',
    });
  }
}

// Tokens go in the body for the apps and in cookies for the web, which never sees them.
export function deliver(
  request: Request,
  response: Response,
  session: IssuedSession,
  mobile = platformOf(request) !== 'web',
): { accessToken?: string; refreshToken?: string; accessExpiresAt: number } {
  const { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt } = session;
  if (mobile) return { accessToken, refreshToken, accessExpiresAt };
  response.cookie(CUSTOMER_ACCESS_COOKIE, accessToken, {
    ...base(),
    httpOnly: true,
    path: '/',
    maxAge: AUTH_TTL_MS.access,
  });
  response.cookie(CUSTOMER_REFRESH_COOKIE, refreshToken, {
    ...base(),
    httpOnly: true,
    path: CUSTOMER_REFRESH_COOKIE_PATH,
    expires: new Date(refreshExpiresAt),
  });
  response.cookie(CSRF_COOKIE, cookies(request)[CSRF_COOKIE] ?? newSecret(), {
    ...base(),
    path: '/',
    expires: new Date(refreshExpiresAt),
  });
  return { accessExpiresAt };
}

export function clearSession(response: Response): void {
  response.clearCookie(CUSTOMER_ACCESS_COOKIE, { ...base(), path: '/' });
  response.clearCookie(CUSTOMER_REFRESH_COOKIE, { ...base(), path: CUSTOMER_REFRESH_COOKIE_PATH });
  response.clearCookie(CSRF_COOKIE, { ...base(), path: '/' });
}
