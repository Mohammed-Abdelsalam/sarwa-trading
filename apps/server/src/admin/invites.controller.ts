import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import {
  type AcceptInviteRequest,
  AcceptInviteRequestSchema,
  ADMIN_ROUTES,
  type CreateInviteRequest,
  CreateInviteRequestSchema,
  type InviteInfo,
  type InviteResponse,
  type InvitesResponse,
  type SessionResponse,
} from '@sarwa/contracts';

import { IdParam } from '../common/params';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminInvitesService } from './admin-invites.service';
import { type Actor } from './audit.service';
import { AdminGuard, CurrentActor, Roles, setAdminSession, toAdminUser } from './auth';

const TokenParam = () => Param('token', new ZodValidationPipe(z.string().min(16).max(256)));

@Controller()
export class InvitesController {
  constructor(private readonly invites: AdminInvitesService) {}

  @Post(ADMIN_ROUTES.invites)
  @UseGuards(AdminGuard)
  @Roles(['ADMIN'])
  async create(
    @Body(new ZodValidationPipe(CreateInviteRequestSchema)) input: CreateInviteRequest,
    @CurrentActor() actor: Actor,
  ): Promise<InviteResponse> {
    return { invite: await this.invites.create(input, actor) };
  }

  @Get(ADMIN_ROUTES.invites)
  @UseGuards(AdminGuard)
  @Roles(['ADMIN'])
  async list(): Promise<InvitesResponse> {
    return { items: await this.invites.list() };
  }

  @Post(ADMIN_ROUTES.resendInvite)
  @UseGuards(AdminGuard)
  @Roles(['ADMIN'])
  async resend(@IdParam() id: string, @CurrentActor() actor: Actor): Promise<InviteResponse> {
    return { invite: await this.invites.resend(id, actor) };
  }

  @Delete(ADMIN_ROUTES.invite)
  @UseGuards(AdminGuard)
  @Roles(['ADMIN'])
  @HttpCode(204)
  revoke(@IdParam() id: string): Promise<void> {
    return this.invites.revoke(id);
  }

  // Public: the invitee has no session yet; the token in the link is the credential.
  @Get(ADMIN_ROUTES.inviteByToken)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  info(@TokenParam() token: string): Promise<InviteInfo> {
    return this.invites.info(token);
  }

  @Post(ADMIN_ROUTES.acceptInvite)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(201)
  async accept(
    @Body(new ZodValidationPipe(AcceptInviteRequestSchema)) input: AcceptInviteRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const signedIn = await this.invites.accept(input, request.ip);
    setAdminSession(response, signedIn);
    return { user: toAdminUser(signedIn.user) };
  }
}
