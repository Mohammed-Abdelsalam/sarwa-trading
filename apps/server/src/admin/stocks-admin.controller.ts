import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { type AdminUser as AdminUserRow, type Stock as StockRow } from '@prisma/client';
import { type Request } from 'express';

import {
  type AdminStock,
  type AdminStocksResponse,
  type CreateStock,
  CreateStockSchema,
  SymbolSchema,
  type UpdateStock,
  UpdateStockSchema,
} from '@sarwa/contracts';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MarketService } from '../market/market.service';
import { PrismaService } from '../prisma.service';
import { AuditService } from './audit.service';
import { AdminGuard, CurrentAdmin, Roles } from './auth';

@Controller('admin/stocks')
@UseGuards(AdminGuard)
export class StocksAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly market: MarketService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(): Promise<AdminStocksResponse> {
    const rows = await this.prisma.stock.findMany({ orderBy: { symbol: 'asc' } });
    return { items: rows.map((row) => this.toAdminStock(row)) };
  }

  @Post()
  @Roles(['ADMIN'])
  async create(
    @Body(new ZodValidationPipe(CreateStockSchema)) input: Required<CreateStock>,
    @CurrentAdmin() admin: AdminUserRow,
    @Req() request: Request,
  ): Promise<AdminStock> {
    const exists = await this.prisma.stock.findUnique({ where: { symbol: input.symbol } });
    if (exists) throw new ConflictException(`Symbol ${input.symbol} already exists`);

    const row = await this.prisma.stock.create({ data: input });
    await this.market.reload();
    await this.audit.log({
      actorEmail: admin.email,
      action: 'stock.create',
      entity: `Stock · ${row.symbol}`,
      payload: input,
      ip: request.ip,
    });
    return this.toAdminStock(row);
  }

  @Patch(':symbol')
  @Roles(['ADMIN'])
  async update(
    @Param('symbol', new ZodValidationPipe(SymbolSchema)) symbol: string,
    @Body(new ZodValidationPipe(UpdateStockSchema)) changes: UpdateStock,
    @CurrentAdmin() admin: AdminUserRow,
    @Req() request: Request,
  ): Promise<AdminStock> {
    const row = await this.prisma.stock.update({ where: { symbol }, data: changes });
    await this.market.reload();
    await this.audit.log({
      actorEmail: admin.email,
      action: 'stock.update',
      entity: `Stock · ${symbol}`,
      payload: { symbol, changes },
      ip: request.ip,
    });
    return this.toAdminStock(row);
  }

  @Delete(':symbol')
  @Roles(['ADMIN'])
  @HttpCode(204)
  async remove(
    @Param('symbol', new ZodValidationPipe(SymbolSchema)) symbol: string,
    @CurrentAdmin() admin: AdminUserRow,
    @Req() request: Request,
  ): Promise<void> {
    await this.prisma.stock.delete({ where: { symbol } });
    await this.market.reload();
    await this.audit.log({
      actorEmail: admin.email,
      action: 'stock.delete',
      entity: `Stock · ${symbol}`,
      payload: { symbol },
      ip: request.ip,
    });
  }

  private toAdminStock(row: StockRow): AdminStock {
    return {
      symbol: row.symbol,
      name: row.name,
      sector: row.sector as AdminStock['sector'],
      exchange: row.exchange as AdminStock['exchange'],
      currency: 'USD',
      basePrice: row.basePrice,
      volatility: row.volatility,
      marketCap: row.marketCap,
      peRatio: row.peRatio,
      isEnabled: row.isEnabled,
      price: this.market.livePrice(row.symbol),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
