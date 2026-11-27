import { Injectable } from '@nestjs/common';

import {
  type AdminStats,
  type MarketCommand,
  type MarketCommandResponse,
  type MarketStatus,
} from '@sarwa/contracts';

import { piiViewOf } from '../common/pii';
import { MarketGateway } from '../market/market.gateway';
import { MarketService } from '../market/market.service';
import { PrismaService } from '../prisma.service';
import { type Actor, type AuditEntry, AuditService } from './audit.service';

// The dashboard overview and the market's run controls.
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly market: MarketService,
    private readonly gateway: MarketGateway,
    private readonly audit: AuditService,
  ) {}

  async stats(viewerRole: string): Promise<AdminStats> {
    const [devices, watchlistItems, top, recentActivity] = await Promise.all([
      this.prisma.device.count(),
      this.prisma.watchlistItem.count(),
      this.prisma.watchlistItem.groupBy({
        by: ['symbol'],
        _count: { symbol: true },
        orderBy: { _count: { symbol: 'desc' } },
        take: 10,
      }),
      this.audit.recent(5, piiViewOf(viewerRole)),
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

  async command(command: MarketCommand, actor: Actor): Promise<MarketCommandResponse> {
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
}
