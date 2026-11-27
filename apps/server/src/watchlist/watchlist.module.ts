import { Controller, Delete, Get, HttpCode, Module, Param, Put } from '@nestjs/common';

import { SymbolSchema, type WatchlistResponse } from '@sarwa/contracts';

import { AppConfigModule } from '../app-config/app-config.module';
import { DeviceId } from '../common/device';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WatchlistService } from './watchlist.service';

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
