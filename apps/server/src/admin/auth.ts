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
import { type Request } from 'express';

import { ADMIN_SESSION_COOKIE, type AdminUser, type Role } from '@sarwa/contracts';

import { PrismaService } from '../prisma.service';

export const SESSION_TTL_SECONDS = 8 * 60 * 60;

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

@Injectable()
// Reloads the admin on every request so role changes and disabled accounts apply immediately.
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<AdminRequest>();
    const token = (request.cookies as Record<string, string | undefined>)[ADMIN_SESSION_COOKIE];
    if (!token) throw new UnauthorizedException('Sign in required');

    let adminId: string;
    try {
      adminId = (await this.jwt.verifyAsync<{ sub: string }>(token)).sub;
    } catch {
      throw new UnauthorizedException('Session expired, sign in again');
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (admin?.status !== 'active') throw new UnauthorizedException('Account disabled');

    const roles = this.reflector.get(Roles, ctx.getHandler()) as Role[] | undefined;
    if (roles && !roles.includes(admin.role as Role)) {
      throw new ForbiddenException('Your role is read-only');
    }

    request.admin = admin;
    return true;
  }
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
