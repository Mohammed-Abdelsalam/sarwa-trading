import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type AdminUser as AdminUserRow } from '@prisma/client';
import { type Request, type Response } from 'express';
import { type z } from 'zod';

import {
  ADMIN_ROUTES,
  ADMIN_SESSION_COOKIE,
  LoginRequestSchema,
  type SessionResponse,
} from '@sarwa/contracts';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { env } from '../env';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard, CurrentAdmin, toAdminUser } from './auth';

@Controller()
export class AuthController {
  constructor(private readonly auth: AdminAuthService) {}

  // Per IP; the per-account lockout lives in AdminAuthService.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(ADMIN_ROUTES.login)
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema))
    { email, password, remember }: z.output<typeof LoginRequestSchema>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const { user, token, ttlSeconds } = await this.auth.signIn(
      email.toLowerCase(),
      password,
      remember,
      request.ip,
    );
    response.cookie(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.NODE_ENV === 'production',
      maxAge: ttlSeconds * 1000,
      path: '/',
    });
    return { user: toAdminUser(user) };
  }

  @Post(ADMIN_ROUTES.logout)
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookies = request.cookies as Record<string, string | undefined>;
    await this.auth.signOut(cookies[ADMIN_SESSION_COOKIE], request.ip);
    response.clearCookie(ADMIN_SESSION_COOKIE, { path: '/' });
  }

  @Get(ADMIN_ROUTES.me)
  @UseGuards(AdminGuard)
  me(@CurrentAdmin() admin: AdminUserRow): SessionResponse {
    return { user: toAdminUser(admin) };
  }
}
