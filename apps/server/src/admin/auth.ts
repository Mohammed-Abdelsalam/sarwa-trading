import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { type AdminUser as AdminUserRow } from '@prisma/client';
import { type Request, type Response } from 'express';

import { ADMIN_SESSION_COOKIE, type AdminUser, type Role } from '@sarwa/contracts';

import { env } from '../env';
import { PrismaService } from '../prisma.service';
import { type Actor } from './audit.service';

export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const REMEMBER_TTL_SECONDS = 7 * 24 * 60 * 60;
// Customer tokens will share the signing secret, so admin tokens name their audience.
export const ADMIN_AUDIENCE = 'admin';

export interface AdminToken {
  sub: string;
  ver: number;
}

export interface AdminRequest extends Request {
  admin?: AdminUserRow;
}

export const Roles = Reflector.createDecorator<Role[]>();

export const CurrentAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AdminUserRow => {
    const admin = ctx.switchToHttp().getRequest<AdminRequest>().admin;
    if (!admin) throw new UnauthorizedException();
    return admin;
  },
);

// Who did it and from where, for the audit log.
export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  const request = ctx.switchToHttp().getRequest<AdminRequest>();
  if (!request.admin) throw new UnauthorizedException();
  return { email: request.admin.email, ip: request.ip };
});

// Reloads the admin on every check so role changes and disabled accounts apply immediately.
@Injectable()
export class AdminSessions {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async verify(token: string | undefined): Promise<AdminUserRow> {
    if (!token) throw new UnauthorizedException('Sign in required');

    let claims: AdminToken;
    try {
      claims = await this.jwt.verifyAsync<AdminToken>(token, { audience: ADMIN_AUDIENCE });
    } catch {
      throw new UnauthorizedException('Session expired, sign in again');
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { id: claims.sub } });
    if (admin?.status !== 'active') throw new UnauthorizedException('Account disabled');
    if (admin.tokenVersion !== claims.ver)
      throw new UnauthorizedException('Signed out, sign in again');
    return admin;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly sessions: AdminSessions,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<AdminRequest>();
    const cookies = request.cookies as Record<string, string | undefined>;
    const admin = await this.sessions.verify(cookies[ADMIN_SESSION_COOKIE]);

    const roles = this.reflector.get(Roles, ctx.getHandler()) as Role[] | undefined;
    if (roles && !roles.includes(admin.role as Role)) {
      throw new ForbiddenException('Your role is read-only');
    }

    request.admin = admin;
    return true;
  }
}

export function setAdminSession(
  response: Response,
  { token, ttlSeconds }: { token: string; ttlSeconds: number },
): void {
  response.cookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.NODE_ENV === 'production',
    maxAge: ttlSeconds * 1000,
    path: '/',
  });
}

export function toAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    status: row.status === 'disabled' ? 'disabled' : 'active',
    lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
