import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { SymbolSchema, type WatchlistResponse } from '@sarwa/contracts';

import { AppConfigModule } from '../app-config/app-config.module';
import { type CustomerRequest, OptionalCustomer } from '../auth/customer.guard';
import { SessionsService } from '../auth/sessions.service';
import { accessTokenOf, deviceIdOf } from '../auth/transport';
import { WritableGuard } from '../common/device';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AccountsService } from '../trading/accounts.service';
import { TradingModule } from '../trading/trading.module';
import { GUEST_WATCHLIST_LIMIT, WatchlistService } from './watchlist.service';

const SymbolParam = () => Param('symbol', new ZodValidationPipe(SymbolSchema));

// A signed-in customer stars into their own account; a guest into their device's account.
@Controller('watchlist')
@OptionalCustomer()
export class WatchlistController {
  constructor(
    private readonly watchlist: WatchlistService,
    private readonly accounts: AccountsService,
    private readonly sessions: SessionsService,
  ) {}

  @Get()
  async list(@Req() request: CustomerRequest): Promise<WatchlistResponse> {
    const accountId = await this.accountOf(request, false);
    return accountId ? this.watchlist.list(accountId) : { symbols: [] };
  }

  @Put(':symbol')
  @UseGuards(WritableGuard)
  @HttpCode(204)
  async add(@Req() request: CustomerRequest, @SymbolParam() symbol: string): Promise<void> {
    const limit = request.principal ? undefined : GUEST_WATCHLIST_LIMIT;
    await this.watchlist.add(await this.accountOf(request, true), symbol, limit);
  }

  @Delete(':symbol')
  @UseGuards(WritableGuard)
  @HttpCode(204)
  async remove(@Req() request: CustomerRequest, @SymbolParam() symbol: string): Promise<void> {
    const accountId = await this.accountOf(request, false);
    if (accountId) await this.watchlist.remove(accountId, symbol);
  }

  private async accountOf(request: CustomerRequest, create: true): Promise<string>;
  private async accountOf(request: CustomerRequest, create: false): Promise<string | null>;
  private async accountOf(request: CustomerRequest, create: boolean): Promise<string | null> {
    if (request.principal) return request.principal.accountId;
    const token = accessTokenOf(request);
    // A stale token must surface its own 401 so the client refreshes, not fall back to the device.
    if (token) await this.sessions.authenticate(token);
    const deviceId = deviceIdOf(request);
    if (!deviceId) throw new UnauthorizedException('Sign in or send a device id');
    return (await this.accounts.forDevice(deviceId, { create }))?.id ?? null;
  }
}

@Module({
  imports: [AppConfigModule, TradingModule],
  controllers: [WatchlistController],
  providers: [WatchlistService],
})
export class WatchlistModule {}
