import { Module } from '@nestjs/common';

import { AppConfigModule } from '../app-config/app-config.module';
import { TradingConfigModule } from '../trading-config/trading-config.module';
import { MarketGateway } from './market.gateway';
import { MarketService } from './market.service';
import { StocksController } from './stocks.controller';

@Module({
  imports: [AppConfigModule, TradingConfigModule],
  controllers: [StocksController],
  providers: [MarketService, MarketGateway],
  exports: [MarketService, MarketGateway],
})
export class MarketModule {}
