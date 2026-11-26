import {
  Controller,
  createParamDecorator,
  Delete,
  type ExecutionContext,
  Get,
  HttpCode,
  Module,
  Param,
  Put,
} from '@nestjs/common';
import { type Request } from 'express';
import { z } from 'zod';

import { DEVICE_ID_HEADER, SymbolSchema, type WatchlistResponse } from '@sarwa/contracts';

import { AppConfigModule } from '../app-config/app-config.module';
import { ValidationException, ZodValidationPipe } from '../common/zod-validation.pipe';
import { WatchlistService } from './watchlist.service';

const DeviceIdSchema = z.uuid('X-Device-Id header must be a UUID');

const DeviceId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const result = DeviceIdSchema.safeParse(
    ctx.switchToHttp().getRequest<Request>().header(DEVICE_ID_HEADER),
  );
  if (!result.success)
    throw new ValidationException({ [DEVICE_ID_HEADER]: ['X-Device-Id header must be a UUID'] });
  return result.data;
});

const SymbolParam = () => Param('symbol', new ZodValidationPipe(SymbolSchema));

@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlist: WatchlistService) {}

  @Get()
  list(@DeviceId() deviceId: string): Promise<WatchlistResponse> {
    return this.watchlist.list(deviceId);
  }

  @Put(':symbol')
  @HttpCode(204)
  add(@DeviceId() deviceId: string, @SymbolParam() symbol: string): Promise<void> {
    return this.watchlist.add(deviceId, symbol);
  }

  @Delete(':symbol')
  @HttpCode(204)
  remove(@DeviceId() deviceId: string, @SymbolParam() symbol: string): Promise<void> {
    return this.watchlist.remove(deviceId, symbol);
  }
}

@Module({
  imports: [AppConfigModule],
  controllers: [WatchlistController],
  providers: [WatchlistService],
})
export class WatchlistModule {}
