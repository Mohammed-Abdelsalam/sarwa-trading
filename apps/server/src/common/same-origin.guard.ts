import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { type Request } from 'express';

import { API_PREFIX } from '@sarwa/contracts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ADMIN_PATH = `/${API_PREFIX}/admin/`;

// The admin app reaches the API through its own Next rewrites, so its writes are always
// same-origin; anything else carrying the admin cookie is a cross-site request forgery.
@Injectable()
export class SameOriginGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== 'http') return true;
    const request = ctx.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method) || !request.path.startsWith(ADMIN_PATH)) return true;

    const site = request.header('sec-fetch-site');
    if (site === 'cross-site' || site === 'same-site') throw this.forbidden();
    const origin = request.header('origin');
    if (origin !== undefined && hostOf(origin) !== request.host) throw this.forbidden();
    return true;
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException('Cross-site admin requests are not allowed');
  }
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}
