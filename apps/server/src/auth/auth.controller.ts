import { Body, Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import {
  AUTH_ROUTES,
  type AuthSessionResponse,
  ForgotPasswordRequestSchema,
  RefreshRequestSchema,
  ResendVerificationRequestSchema,
  type ResetPasswordInfo,
  ResetPasswordRequestSchema,
  SignInRequestSchema,
  SignUpRequestSchema,
  type VerifyEmailResponse,
  VerifyEmailRequestSchema,
} from '@sarwa/contracts';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService, type SignedIn } from './auth.service';
import { MaybePrincipal, OptionalCustomer, Public } from './customer.guard';
import { RecoveryService } from './recovery.service';
import { type Principal } from './sessions.service';
import {
  assertCookieWriteAllowed,
  clearSession,
  clientOf,
  deliver,
  deviceIdOf,
  refreshCookieOf,
  usesBearer,
} from './transport';

// The web posts no body at all: its refresh token is the cookie.
const OptionalRefresh = RefreshRequestSchema.default({});
const TokenParam = () => Param('token', new ZodValidationPipe(z.string().min(16).max(256)));

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly recovery: RecoveryService,
  ) {}

  @Post(AUTH_ROUTES.signUp)
  @Public()
  async signUp(
    @Body(new ZodValidationPipe(SignUpRequestSchema)) input: z.output<typeof SignUpRequestSchema>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponse> {
    const client = clientOf(request, input.deviceModel);
    const signedIn = await this.auth.signUp(input, client, deviceIdOf(request));
    return respond(request, response, signedIn);
  }

  @Post(AUTH_ROUTES.signIn)
  @Public()
  @HttpCode(200)
  async signIn(
    @Body(new ZodValidationPipe(SignInRequestSchema)) input: z.output<typeof SignInRequestSchema>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponse> {
    const client = clientOf(request, input.deviceModel);
    const signedIn = await this.auth.signIn(input, client, deviceIdOf(request));
    return respond(request, response, signedIn);
  }

  // The apps send their refresh token in the body; the web sends the refresh cookie.
  @Post(AUTH_ROUTES.refresh)
  @Public()
  @HttpCode(200)
  async refresh(
    @Body(new ZodValidationPipe(OptionalRefresh)) { refreshToken }: { refreshToken?: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponse> {
    const token = refreshToken ?? refreshCookieOf(request);
    if (!refreshToken) assertCookieWriteAllowed(request);
    try {
      const signedIn = await this.auth.refresh(token ?? '', clientOf(request));
      return respond(request, response, signedIn, refreshToken !== undefined);
    } catch (error) {
      if (!refreshToken) clearSession(response);
      throw error;
    }
  }

  @Post(AUTH_ROUTES.signOut)
  @OptionalCustomer()
  @HttpCode(204)
  async signOut(
    @Body(new ZodValidationPipe(OptionalRefresh)) { refreshToken }: { refreshToken?: string },
    @MaybePrincipal() principal: Principal | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookie = usesBearer(request) ? undefined : refreshCookieOf(request);
    if (cookie && !principal) assertCookieWriteAllowed(request);
    await this.auth.signOut(principal, refreshToken ?? cookie, request.ip);
    if (!usesBearer(request)) clearSession(response);
  }

  @Post(AUTH_ROUTES.forgot)
  @Public()
  @HttpCode(202)
  async forgot(
    @Body(new ZodValidationPipe(ForgotPasswordRequestSchema)) { email }: { email: string },
    @Req() request: Request,
  ): Promise<void> {
    await this.recovery.forgot(email, request.ip);
  }

  @Get(AUTH_ROUTES.resetInfo)
  @Public()
  resetInfo(@TokenParam() token: string): Promise<ResetPasswordInfo> {
    return this.recovery.resetInfo(token);
  }

  @Post(AUTH_ROUTES.reset)
  @Public()
  @HttpCode(200)
  async reset(
    @Body(new ZodValidationPipe(ResetPasswordRequestSchema))
    input: z.output<typeof ResetPasswordRequestSchema>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponse> {
    const signedIn = await this.recovery.reset(input, clientOf(request, input.deviceModel));
    return respond(request, response, signedIn);
  }

  @Post(AUTH_ROUTES.verify)
  @Public()
  @HttpCode(200)
  verify(
    @Body(new ZodValidationPipe(VerifyEmailRequestSchema)) { token }: { token: string },
  ): Promise<VerifyEmailResponse> {
    return this.recovery.verify(token);
  }

  // Signed in, the session's email; from the expired-link page, the email that page showed.
  @Post(AUTH_ROUTES.resendVerify)
  @OptionalCustomer()
  @HttpCode(202)
  async resendVerification(
    @Body(new ZodValidationPipe(ResendVerificationRequestSchema.default({})))
    { email }: { email?: string },
    @MaybePrincipal() principal: Principal | undefined,
  ): Promise<void> {
    const target = principal ? (await this.auth.user(principal.userId)).email : email;
    if (target) await this.recovery.resendVerification(target);
  }
}

function respond(
  request: Request,
  response: Response,
  { session, ...rest }: SignedIn,
  mobile?: boolean,
): AuthSessionResponse {
  return { ...rest, ...deliver(request, response, session, mobile) };
}
