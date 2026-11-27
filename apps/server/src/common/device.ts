import { type CanActivate, Injectable, ServiceUnavailableException } from '@nestjs/common';

import { AppConfigService } from '../app-config/app-config.service';

@Injectable()
export class WritableGuard implements CanActivate {
  constructor(private readonly appConfig: AppConfigService) {}

  canActivate(): boolean {
    if (this.appConfig.get().maintenanceMode) {
      throw new ServiceUnavailableException('Read-only during maintenance');
    }
    return true;
  }
}
