import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { ErrorCode, type HealthResponse } from '@sarwa/contracts';

import { AdminModule } from './admin/admin.module';
import { AppConfigModule } from './app-config/app-config.module';
import { MarketModule } from './market/market.module';
import { PrismaModule, PrismaService } from './prisma.service';
import { WatchlistModule } from './watchlist/watchlist.module';

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
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AppConfigModule,
    MarketModule,
    WatchlistModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
