import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { type AdminUser as AdminUserRow } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { type Request, type Response } from 'express';

import {
  ADMIN_SESSION_COOKIE,
  type LoginRequest,
  LoginRequestSchema,
  type SessionResponse,
} from '@sarwa/contracts';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { env } from '../env';
import { PrismaService } from '../prisma.service';
import { AuditService } from './audit.service';
import { AdminGuard, CurrentAdmin, SESSION_TTL_SECONDS, toAdminUser } from './auth';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  // Brute-force protection: 5 login attempts per minute per IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) { email, password }: LoginRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const user = await this.prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });

    // Always run bcrypt and answer with one error, so neither timing nor message reveals which emails exist.
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid || user.status !== 'active') {
      throw new UnauthorizedException('Invalid email or password');
    }

    const updated = await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });
    const token = await this.jwt.signAsync({ sub: user.id }, { expiresIn: SESSION_TTL_SECONDS });
    response.cookie(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.NODE_ENV === 'production',
      maxAge: SESSION_TTL_SECONDS * 1000,
      path: '/',
    });
    await this.audit.log({
      actorEmail: user.email,
      action: 'auth.login',
      entity: 'Session',
      ip: request.ip,
    });
    return { user: toAdminUser(updated) };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(ADMIN_SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(@CurrentAdmin() admin: AdminUserRow): SessionResponse {
    return { user: toAdminUser(admin) };
  }
}
