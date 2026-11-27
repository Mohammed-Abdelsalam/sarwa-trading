import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Request } from 'express';

import { API_PREFIX } from '@sarwa/contracts';

import { type Principal, SessionsService } from './sessions.service';
import { accessTokenOf, assertCookieWriteAllowed, usesBearer } from './transport';

type Access = 'public' | 'optional';
const ACCESS = 'customer-access';
const ADMIN_PATH = `/${API_PREFIX}/admin/`;

// Open to guests. `OptionalCustomer` also resolves a signed-in caller when there is one.
export const Public = () => SetMetadata(ACCESS, 'public' satisfies Access);
export const OptionalCustomer = () => SetMetadata(ACCESS, 'optional' satisfies Access);

export interface CustomerRequest extends Request {
  principal?: Principal;
}

export const CurrentPrincipal = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Principal => {
    const principal = ctx.switchToHttp().getRequest<CustomerRequest>().principal;
    if (!principal) throw new UnauthorizedException('Sign in required');
    return principal;
  },
);

export const MaybePrincipal = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Principal | undefined =>
    ctx.switchToHttp().getRequest<CustomerRequest>().principal,
);

export const CurrentAccountId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const principal = ctx.switchToHttp().getRequest<CustomerRequest>().principal;
    if (!principal) throw new UnauthorizedException('Sign in required');
    return principal.accountId;
  },
);

// Default-deny: every route needs a signed-in customer unless marked otherwise. Admin routes
// authenticate with their own cookie and AdminGuard.
@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const request = ctx.switchToHttp().getRequest<CustomerRequest>();
    if (request.path.startsWith(ADMIN_PATH)) return true;
    const access = this.reflector.getAllAndOverride<Access | undefined>(ACCESS, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (access === 'public') return true;

    const token = accessTokenOf(request);
    if (!token) {
      if (access === 'optional') return true;
      throw new UnauthorizedException('Sign in required');
    }
    try {
      request.principal = await this.sessions.authenticate(token);
    } catch (error) {
      if (access === 'optional') return true;
      throw error;
    }
    if (!usesBearer(request)) assertCookieWriteAllowed(request);
    return true;
  }
}
