import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';

import {
  CandlesQuerySchema,
  type CandlesQuery,
  type CandlesResponse,
  type StockDetailResponse,
  type StocksQuery,
  StocksQuerySchema,
  type StocksResponse,
  SymbolSchema,
} from '@sarwa/contracts';

import { Public } from '../auth/customer.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MarketService } from './market.service';

@Public()
@Controller('stocks')
export class StocksController {
  constructor(private readonly market: MarketService) {}

  @Get()
  list(@Query(new ZodValidationPipe(StocksQuerySchema)) { q }: StocksQuery): StocksResponse {
    return { items: this.market.listStocks(q) };
  }

  @Get(':symbol')
  detail(
    @Param('symbol', new ZodValidationPipe(SymbolSchema)) symbol: string,
  ): StockDetailResponse {
    const found = this.market.find(symbol);
    const stats = this.market.stats(symbol);
    if (!found || !stats) throw new NotFoundException(`Unknown symbol ${symbol}`);
    return { ...found, stats };
  }

  @Get(':symbol/candles')
  candles(
    @Param('symbol', new ZodValidationPipe(SymbolSchema)) symbol: string,
    @Query(new ZodValidationPipe(CandlesQuerySchema)) { period }: CandlesQuery,
  ): CandlesResponse {
    if (!this.market.find(symbol)) throw new NotFoundException(`Unknown symbol ${symbol}`);
    return { symbol, period, candles: this.market.candles(symbol, period) };
  }
}
