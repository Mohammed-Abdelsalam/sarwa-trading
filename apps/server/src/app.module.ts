import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AdminModule } from './admin/admin.module';
import { AuditModule } from './admin/audit.service';
import { AppConfigModule } from './app-config/app-config.module';
import { ClockModule } from './common/clock';
import { EventsModule } from './common/events';
import { RandomModule } from './common/random';
import { SameOriginGuard } from './common/same-origin.guard';
import { HealthController } from './health.controller';
import { MarketModule } from './market/market.module';
import { PrismaModule } from './prisma.service';
import { TradingModule } from './trading/trading.module';
import { WatchlistModule } from './watchlist/watchlist.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    ClockModule,
    EventsModule,
    RandomModule,
    AuditModule,
    AppConfigModule,
    MarketModule,
    WatchlistModule,
    AdminModule,
    TradingModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SameOriginGuard },
  ],
})
export class AppModule {}
