import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { type AdminUser as AdminUserRow } from '@prisma/client';

import {
  ADMIN_ROUTES,
  type AdminStats,
  type AppConfig,
  type AuditPage,
  type AuditQuery,
  AuditQuerySchema,
  type MarketCommand,
  type MarketCommandResponse,
  MarketCommandSchema,
  type UpdateAppConfig,
  UpdateAppConfigSchema,
} from '@sarwa/contracts';

import { AppConfigService } from '../app-config/app-config.service';
import { piiViewOf } from '../common/pii';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminService } from './admin.service';
import { type Actor, AuditService } from './audit.service';
import { AdminGuard, CurrentActor, CurrentAdmin, Roles } from './auth';

@Controller()
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly appConfig: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  @Get(ADMIN_ROUTES.stats)
  stats(@CurrentAdmin() viewer: AdminUserRow): Promise<AdminStats> {
    return this.admin.stats(viewer.role);
  }

  @Post(ADMIN_ROUTES.market)
  @Roles(['ADMIN'])
  command(
    @Body(new ZodValidationPipe(MarketCommandSchema)) command: MarketCommand,
    @CurrentActor() actor: Actor,
  ): Promise<MarketCommandResponse> {
    return this.admin.command(command, actor);
  }

  @Patch(ADMIN_ROUTES.config)
  @Roles(['ADMIN'])
  updateConfig(
    @Body(new ZodValidationPipe(UpdateAppConfigSchema)) patch: UpdateAppConfig,
    @CurrentActor() actor: Actor,
  ): Promise<AppConfig> {
    return this.appConfig.update(patch, actor);
  }

  @Get(ADMIN_ROUTES.audit)
  auditLog(
    @Query(new ZodValidationPipe(AuditQuerySchema)) query: AuditQuery,
    @CurrentAdmin() viewer: AdminUserRow,
  ): Promise<AuditPage> {
    return this.audit.list(query, piiViewOf(viewer.role));
  }
}
