import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';

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
  type MarketStatus,
  type UpdateAppConfig,
  UpdateAppConfigSchema,
} from '@sarwa/contracts';

import { AppConfigService } from '../app-config/app-config.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MarketGateway } from '../market/market.gateway';
import { MarketService } from '../market/market.service';
import { PrismaService } from '../prisma.service';
import { type Actor, type AuditEntry, AuditService } from './audit.service';
import { AdminGuard, CurrentActor, Roles } from './auth';

@Controller()
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly market: MarketService,
    private readonly gateway: MarketGateway,
    private readonly appConfig: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  @Get(ADMIN_ROUTES.stats)
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

  @Post(ADMIN_ROUTES.market)
  @Roles(['ADMIN'])
  async command(
    @Body(new ZodValidationPipe(MarketCommandSchema)) command: MarketCommand,
    @CurrentActor() actor: Actor,
  ): Promise<MarketCommandResponse> {
    const before = this.market.getStatus();
    const log = (action: AuditEntry['action'], payload: Record<string, unknown>) =>
      this.audit.log({ actorEmail: actor.email, action, entity: 'Market', payload, ip: actor.ip });
    const change = async (
      action: AuditEntry['action'],
      apply: () => MarketStatus,
    ): Promise<MarketCommandResponse> => {
      const status = apply();
      await log(action, {
        before: { state: before.state, volatility: before.volatility },
        after: { state: status.state, volatility: status.volatility },
      });
      return { status };
    };

    switch (command.action) {
      case 'pause':
        return change('market.pause', () => this.market.pause());
      case 'resume':
        return change('market.resume', () => this.market.resume());
      case 'setVolatility':
        return change('market.volatility', () => this.market.setVolatility(command.volatility));
      case 'dropConnections': {
        const dropped = this.gateway.dropAll();
        await log('connections.drop', { dropped });
        return { status: before, dropped };
      }
    }
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
  auditLog(@Query(new ZodValidationPipe(AuditQuerySchema)) query: AuditQuery): Promise<AuditPage> {
    return this.audit.list(query);
  }
}
