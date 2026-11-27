import { Controller, Get, Module } from '@nestjs/common';

import { type AppConfig } from '@sarwa/contracts';

import { Public } from '../auth/customer.guard';
import { AppConfigService } from './app-config.service';

@Public()
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfig: AppConfigService) {}

  @Get()
  get(): AppConfig {
    return this.appConfig.get();
  }
}

@Module({
  controllers: [AppConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
