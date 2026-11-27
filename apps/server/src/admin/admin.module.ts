import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AppConfigModule } from '../app-config/app-config.module';
import { env } from '../env';
import { MarketModule } from '../market/market.module';
import { AdminAuthService } from './admin-auth.service';
import { AdminInvitesService } from './admin-invites.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';
import { AdminGateway } from './admin.gateway';
import { AdminService } from './admin.service';
import { AdminGuard, AdminSessions } from './auth';
import { AuthController } from './auth.controller';
import { InvitesController } from './invites.controller';
import { StocksAdminController } from './stocks-admin.controller';
import { StocksAdminService } from './stocks-admin.service';
import { UsersController } from './users.controller';

@Module({
  imports: [JwtModule.register({ secret: env.JWT_SECRET }), MarketModule, AppConfigModule],
  controllers: [
    AuthController,
    AdminController,
    StocksAdminController,
    UsersController,
    InvitesController,
  ],
  providers: [
    AdminSessions,
    AdminGuard,
    AdminGateway,
    AdminAuthService,
    AdminService,
    AdminUsersService,
    AdminInvitesService,
    StocksAdminService,
  ],
  exports: [AdminSessions, AdminGuard],
})
export class AdminModule {}
