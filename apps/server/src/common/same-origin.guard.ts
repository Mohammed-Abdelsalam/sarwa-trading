import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { type Request } from 'express';

import { API_PREFIX } from '@sarwa/contracts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const GUARDED_PATHS = [`/${API_PREFIX}/admin/`, `/${API_PREFIX}/auth/`];

// The admin and web apps reach the API through their own Next rewrites, so their writes are
// always same-origin; anything else carrying their cookies is a cross-site request forgery.
// Customer writes made with the session cookie also need the CSRF token (see auth/transport).
@Injectable()
export class SameOriginGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== 'http') return true;
    const request = ctx.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (!GUARDED_PATHS.some((path) => request.path.startsWith(path))) return true;

    if (isCrossSite(request)) throw this.forbidden();
    return true;
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException('Cross-site requests are not allowed');
  }
}

// Browsers send these on every write; a non-browser client sends neither and has no cookies to abuse.
export function isCrossSite(request: Request): boolean {
  const site = request.header('sec-fetch-site');
  if (site === 'cross-site' || site === 'same-site') return true;
  const origin = request.header('origin');
  return origin !== undefined && hostOf(origin) !== request.host;
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}
