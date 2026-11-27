import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AdminModule } from './admin/admin.module';
import { AuditModule } from './admin/audit.service';
import { AppConfigModule } from './app-config/app-config.module';
import { AuthModule } from './auth/auth.module';
import { CustomerGuard } from './auth/customer.guard';
import { IdentityModule } from './auth/identity.module';
import { ClockModule } from './common/clock';
import { EventsModule } from './common/events';
import { PasswordModule } from './common/password-hasher';
import { RandomModule } from './common/random';
import { SameOriginGuard } from './common/same-origin.guard';
import { CustomersModule } from './customers/customers.module';
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
    PasswordModule,
    IdentityModule,
    AuditModule,
    AppConfigModule,
    MarketModule,
    WatchlistModule,
    AdminModule,
    TradingModule,
    AuthModule,
    CustomersModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SameOriginGuard },
    { provide: APP_GUARD, useClass: CustomerGuard },
  ],
})
export class AppModule {}
