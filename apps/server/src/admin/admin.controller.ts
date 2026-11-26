import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { type AdminUser as AdminUserRow } from '@prisma/client';
import { type Request } from 'express';

import {
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
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MarketGateway } from '../market/market.gateway';
import { MarketService } from '../market/market.service';
import { PrismaService } from '../prisma.service';
import { AuditService } from './audit.service';
import { AdminGuard, CurrentAdmin, Roles } from './auth';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly market: MarketService,
    private readonly gateway: MarketGateway,
    private readonly appConfig: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  @Get('stats')
  async stats(): Promise<AdminStats> {
    const [devices, watchlistItems, top, recentActivity] = await Promise.all([
      this.prisma.device.count(),
      this.prisma.watchlistItem.count(),
      this.prisma.watchlistItem.groupBy({
        by: ['symbol'],
        _count: { symbol: true },
        orderBy: { _count: { symbol: 'desc' } },
        take: 10,
      }),
      this.audit.recent(5),
    ]);
    const { enabled, total } = this.market.counts();
    return {
      ...this.gateway.stats(),
      devices,
      watchlistItems,
      topWatchlisted: top.map((row) => ({ symbol: row.symbol, count: row._count.symbol })),
      market: {
        ...this.market.getStatus(),
        ticksPerSecond: this.market.ticksPerSecond(),
        enabledSymbols: enabled,
        totalSymbols: total,
      },
      recentActivity,
    };
  }

  @Post('market')
  @Roles(['ADMIN'])
  async command(
    @Body(new ZodValidationPipe(MarketCommandSchema)) command: MarketCommand,
    @CurrentAdmin() admin: AdminUserRow,
    @Req() request: Request,
  ): Promise<MarketCommandResponse> {
    const before = this.market.getStatus();
    const log = (
      action: Parameters<AuditService['log']>[0]['action'],
      payload: Record<string, unknown>,
    ) =>
      this.audit.log({
        actorEmail: admin.email,
        action,
        entity: 'Market',
        payload,
        ip: request.ip,
      });

    switch (command.action) {
      case 'pause':
        await log('market.pause', { status: 'paused', prev: before.state });
        return { status: this.market.pause() };
      case 'resume':
        await log('market.resume', { status: 'running', prev: before.state });
        return { status: this.market.resume() };
      case 'setVolatility':
        await log('market.volatility', { from: before.volatility, to: command.volatility });
        return { status: this.market.setVolatility(command.volatility) };
      case 'dropConnections': {
        const dropped = this.gateway.dropAll();
        await log('connections.drop', { dropped });
        return { status: before, dropped };
      }
    }
  }

  @Patch('config')
  @Roles(['ADMIN'])
  async updateConfig(
    @Body(new ZodValidationPipe(UpdateAppConfigSchema)) patch: UpdateAppConfig,
    @CurrentAdmin() admin: AdminUserRow,
    @Req() request: Request,
  ): Promise<AppConfig> {
    const config = await this.appConfig.update(patch);
    await this.audit.log({
      actorEmail: admin.email,
      action: 'config.update',
      entity: `Config · ${Object.keys(patch).join(', ')}`,
      payload: patch,
      ip: request.ip,
    });
    return config;
  }

  @Get('audit')
  auditLog(@Query(new ZodValidationPipe(AuditQuerySchema)) query: AuditQuery): Promise<AuditPage> {
    return this.audit.list(query);
  }
}
