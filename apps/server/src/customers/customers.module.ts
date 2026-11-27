import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { TradingModule } from '../trading/trading.module';
import { AdminCustomersService } from './admin-customers.service';
import { CustomerActionsService } from './customer-actions.service';
import { CustomersController } from './customers.controller';

// The admin's view of customers. Admins manage customers; they never create them.
@Module({
  imports: [AdminModule, TradingModule, AuthModule],
  controllers: [CustomersController],
  providers: [AdminCustomersService, CustomerActionsService],
})
export class CustomersModule {}
