import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { type Request } from 'express';
import { z } from 'zod';

import { DEVICE_ID_HEADER } from '@sarwa/contracts';

import { AppConfigService } from '../app-config/app-config.service';
import { ValidationException } from './zod-validation.pipe';

const DeviceIdSchema = z.uuid('X-Device-Id header must be a UUID');

export const DeviceId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const result = DeviceIdSchema.safeParse(
    ctx.switchToHttp().getRequest<Request>().header(DEVICE_ID_HEADER),
  );
  if (!result.success)
    throw new ValidationException({ [DEVICE_ID_HEADER]: ['X-Device-Id header must be a UUID'] });
  return result.data;
});

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
