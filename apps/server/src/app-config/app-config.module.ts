import { Controller, Get, Module } from '@nestjs/common';

import { type AppConfig } from '@sarwa/contracts';

import { AppConfigService } from './app-config.service';

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
