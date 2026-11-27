import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { type Request, type Response } from 'express';

import {
  AUTH_ROUTES,
  type ChangePasswordRequest,
  ChangePasswordRequestSchema,
  type ChangePasswordResponse,
  type DeleteAccountRequest,
  DeleteAccountRequestSchema,
  type DeleteAccountResponse,
  type MeResponse,
  type MeSummary,
  type RevokeOthersResponse,
  SelfResetRequestSchema,
  type SelfResetResponse,
  type SessionsResponse,
  type UpdateProfileRequest,
  UpdateProfileRequestSchema,
} from '@sarwa/contracts';

import { WritableGuard } from '../common/device';
import { IdParam } from '../common/params';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentPrincipal } from './customer.guard';
import { MeService } from './me.service';
import { type Principal } from './sessions.service';
import { clearSession, usesBearer } from './transport';

@Controller()
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get(AUTH_ROUTES.me)
  async profile(@CurrentPrincipal() principal: Principal): Promise<MeResponse> {
    return { user: await this.me.me(principal) };
  }

  @Patch(AUTH_ROUTES.profile)
  async rename(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodValidationPipe(UpdateProfileRequestSchema)) { name }: UpdateProfileRequest,
  ): Promise<MeResponse> {
    return { user: await this.me.rename(principal, name) };
  }

  @Get(AUTH_ROUTES.summary)
  summary(@CurrentPrincipal() principal: Principal): Promise<MeSummary> {
    return this.me.summary(principal);
  }

  @Post(AUTH_ROUTES.password)
  @HttpCode(200)
  changePassword(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodValidationPipe(ChangePasswordRequestSchema))
    { current, next }: ChangePasswordRequest,
  ): Promise<ChangePasswordResponse> {
    return this.me.changePassword(principal, current, next);
  }

  @Post(AUTH_ROUTES.deleteAccount)
  @HttpCode(202)
  async requestDeletion(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodValidationPipe(DeleteAccountRequestSchema)) { password }: DeleteAccountRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DeleteAccountResponse> {
    const answer = await this.me.requestDeletion(principal, password, request.ip);
    if (!usesBearer(request)) clearSession(response);
    return answer;
  }

  @Post(AUTH_ROUTES.selfReset)
  @UseGuards(WritableGuard)
  @HttpCode(200)
  async resetPaperAccount(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodValidationPipe(SelfResetRequestSchema)) _confirmed: unknown,
    @Req() request: Request,
  ): Promise<SelfResetResponse> {
    return { account: await this.me.resetPaperAccount(principal, request.ip) };
  }

  @Get(AUTH_ROUTES.sessions)
  async sessions(@CurrentPrincipal() principal: Principal): Promise<SessionsResponse> {
    return { items: await this.me.sessionsOf(principal) };
  }

  @Delete(AUTH_ROUTES.revokeSession)
  @HttpCode(204)
  signOutSession(@CurrentPrincipal() principal: Principal, @IdParam() id: string): Promise<void> {
    return this.me.signOutSession(principal, id);
  }

  @Post(AUTH_ROUTES.signOutOthers)
  @HttpCode(200)
  signOutOthers(@CurrentPrincipal() principal: Principal): Promise<RevokeOthersResponse> {
    return this.me.signOutOthers(principal);
  }
}
