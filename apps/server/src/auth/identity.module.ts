import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { RateLimiter } from '../common/rate-limiter';
import { env } from '../env';
import { CustomerMetrics } from './customer-metrics.service';
import { CustomerGuard } from './customer.guard';
import { LogMailer, Mailer } from './mailer';
import { OneTimeTokens } from './one-time-tokens.service';
import { SessionsService } from './sessions.service';

// Who the caller is: sessions, the default-deny guard and the pieces every auth flow shares.
@Global()
@Module({
  imports: [JwtModule.register({ secret: env.JWT_SECRET })],
  providers: [
    SessionsService,
    CustomerGuard,
    CustomerMetrics,
    OneTimeTokens,
    RateLimiter,
    { provide: Mailer, useClass: LogMailer },
  ],
  exports: [
    JwtModule,
    SessionsService,
    CustomerGuard,
    CustomerMetrics,
    OneTimeTokens,
    RateLimiter,
    Mailer,
  ],
})
export class IdentityModule {}
