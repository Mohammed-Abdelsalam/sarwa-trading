import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { ErrorCode, type HealthResponse } from '@sarwa/contracts';

import { AdminModule } from './admin/admin.module';
import { AuditModule } from './admin/audit.service';
import { AppConfigModule } from './app-config/app-config.module';
import { ClockModule } from './common/clock';
import { MarketModule } from './market/market.module';
import { PrismaModule, PrismaService } from './prisma.service';
import { TradingModule } from './trading/trading.module';
import { WatchlistModule } from './watchlist/watchlist.module';

const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
  version: string;
};
// CI and deploys set GIT_SHA; a local run has no build to point at.
const sha = process.env.GIT_SHA?.trim() ?? '';
const commit = sha ? sha.slice(0, 7) : 'dev';

@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        code: ErrorCode.Unavailable,
        message: 'Database unavailable',
      });
    }
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()), version, commit };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    ClockModule,
    AuditModule,
    AppConfigModule,
    MarketModule,
    WatchlistModule,
    AdminModule,
    TradingModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
