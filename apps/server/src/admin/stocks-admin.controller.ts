import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  ADMIN_ROUTES,
  type AdminStock,
  type AdminStocksResponse,
  type CreateStock,
  CreateStockSchema,
  SymbolSchema,
  type UpdateStock,
  UpdateStockSchema,
} from '@sarwa/contracts';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { type Actor } from './audit.service';
import { AdminGuard, CurrentActor, Roles } from './auth';
import { StocksAdminService } from './stocks-admin.service';

const SymbolParam = () => Param('symbol', new ZodValidationPipe(SymbolSchema));

@Controller()
@UseGuards(AdminGuard)
export class StocksAdminController {
  constructor(private readonly stocks: StocksAdminService) {}

  @Get(ADMIN_ROUTES.stocks)
  list(): Promise<AdminStocksResponse> {
    return this.stocks.list();
  }

  @Post(ADMIN_ROUTES.stocks)
  @Roles(['ADMIN'])
  create(
    @Body(new ZodValidationPipe(CreateStockSchema)) input: Required<CreateStock>,
    @CurrentActor() actor: Actor,
  ): Promise<AdminStock> {
    return this.stocks.create(input, actor);
  }

  @Patch(ADMIN_ROUTES.stock)
  @Roles(['ADMIN'])
  update(
    @SymbolParam() symbol: string,
    @Body(new ZodValidationPipe(UpdateStockSchema)) changes: UpdateStock,
    @CurrentActor() actor: Actor,
  ): Promise<AdminStock> {
    return this.stocks.update(symbol, changes, actor);
  }

  @Delete(ADMIN_ROUTES.stock)
  @Roles(['ADMIN'])
  @HttpCode(204)
  remove(@SymbolParam() symbol: string, @CurrentActor() actor: Actor): Promise<void> {
    return this.stocks.remove(symbol, actor);
  }
}
