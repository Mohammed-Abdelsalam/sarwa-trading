import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { type HealthResponse } from '@sarwa/contracts';

import { AdminModule } from './admin/admin.module';
import { AppConfigModule } from './app-config/app-config.module';
import { MarketModule } from './market/market.module';
import { PrismaModule } from './prisma.service';
import { WatchlistModule } from './watchlist/watchlist.module';

@Controller('health')
class HealthController {
  @Get()
  check(): HealthResponse {
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
