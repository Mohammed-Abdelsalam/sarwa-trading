import { Module } from '@nestjs/common';

import { TradingConfigService } from './trading-config.service';

@Module({ providers: [TradingConfigService], exports: [TradingConfigService] })
export class TradingConfigModule {}
