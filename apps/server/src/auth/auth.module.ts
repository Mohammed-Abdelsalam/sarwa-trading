import { Module } from '@nestjs/common';

import { AppConfigModule } from '../app-config/app-config.module';
import { TradingModule } from '../trading/trading.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { RecoveryService } from './recovery.service';
import { RetentionService } from './retention.service';

@Module({
  imports: [AppConfigModule, TradingModule],
  controllers: [AuthController, MeController],
  providers: [AuthService, RecoveryService, MeService, RetentionService],
  exports: [RecoveryService],
})
export class AuthModule {}
