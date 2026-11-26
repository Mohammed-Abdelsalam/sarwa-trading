import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AppConfigModule } from '../app-config/app-config.module';
import { env } from '../env';
import { MarketModule } from '../market/market.module';
import { AdminController } from './admin.controller';
import { AuditService } from './audit.service';
import { AdminGuard } from './auth';
import { AuthController } from './auth.controller';
import { StocksAdminController } from './stocks-admin.controller';
import { UsersController } from './users.controller';

@Module({
  imports: [JwtModule.register({ secret: env.JWT_SECRET }), MarketModule, AppConfigModule],
  controllers: [AuthController, AdminController, StocksAdminController, UsersController],
  providers: [AdminGuard, AuditService],
})
export class AdminModule {}
