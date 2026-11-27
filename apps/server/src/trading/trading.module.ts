import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { WritableGuard } from '../common/device';
import { MarketModule } from '../market/market.module';
import { TradingConfigModule } from '../trading-config/trading-config.module';
import { AccountLifecycleService } from './account-lifecycle.service';
import { AccountController, AlertsController, NotificationsController } from './account.controller';
import { AccountsService } from './accounts.service';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminOrdersService } from './admin-orders.service';
import { AdminOrdersController, AdminTradingController } from './admin-trading.controller';
import { AlertsService } from './alerts.service';
import { CircuitBreaker } from './circuit-breaker';
import { TradingEngine } from './engine.service';
import { ExecutionQueue } from './execution-queue';
import { ExecutionService } from './execution.service';
import { HaltsService } from './halts.service';
import { NotificationsService } from './notifications.service';
import { OrderBook } from './order-book';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PortfolioService } from './portfolio.service';
import { pushSenderProvider } from './push';
import { StatusService } from './status.service';
import { TradingGateway } from './trading.gateway';

@Module({
  imports: [AppConfigModule, TradingConfigModule, MarketModule, AdminModule],
  controllers: [
    AccountController,
    OrdersController,
    AlertsController,
    NotificationsController,
    AdminTradingController,
    AdminOrdersController,
  ],
  providers: [
    WritableGuard,
    ExecutionQueue,
    OrderBook,
    CircuitBreaker,
    pushSenderProvider,
    TradingGateway,
    AccountsService,
    AccountLifecycleService,
    NotificationsService,
    HaltsService,
    StatusService,
    ExecutionService,
    OrdersService,
    AlertsService,
    PortfolioService,
    AdminAccountsService,
    AdminOrdersService,
    TradingEngine,
  ],
  exports: [
    TradingEngine,
    AccountsService,
    ExecutionQueue,
    AccountLifecycleService,
    NotificationsService,
    PortfolioService,
    AdminAccountsService,
    OrdersService,
  ],
})
export class TradingModule {}
