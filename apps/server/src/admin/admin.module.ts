import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AppConfigModule } from '../app-config/app-config.module';
import { env } from '../env';
import { MarketModule } from '../market/market.module';
import { AdminController } from './admin.controller';
import { AdminGateway } from './admin.gateway';
import { AdminGuard, AdminSessions } from './auth';
import { AuthController } from './auth.controller';
import { StocksAdminController } from './stocks-admin.controller';
import { UsersController } from './users.controller';

@Module({
  imports: [JwtModule.register({ secret: env.JWT_SECRET }), MarketModule, AppConfigModule],
  controllers: [AuthController, AdminController, StocksAdminController, UsersController],
  providers: [AdminSessions, AdminGuard, AdminGateway],
  exports: [AdminSessions, AdminGuard, AdminGateway],
})
export class AdminModule {}
