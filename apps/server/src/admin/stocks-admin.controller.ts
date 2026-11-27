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
  UseGuards,
} from '@nestjs/common';
import { type Stock as StockRow } from '@prisma/client';

import {
  ADMIN_ROUTES,
  type AdminStock,
  type AdminStocksResponse,
  type CreateStock,
  CreateStockSchema,
  ErrorCode,
  SymbolSchema,
  type UpdateStock,
  UpdateStockSchema,
} from '@sarwa/contracts';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MarketService } from '../market/market.service';
import { PrismaService } from '../prisma.service';
import { type Actor, AuditService } from './audit.service';
import { AdminGuard, CurrentActor, Roles } from './auth';

@Controller()
@UseGuards(AdminGuard)
export class StocksAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly market: MarketService,
    private readonly audit: AuditService,
  ) {}

  @Get(ADMIN_ROUTES.stocks)
  async list(): Promise<AdminStocksResponse> {
    const rows = await this.prisma.stock.findMany({ orderBy: { symbol: 'asc' } });
    return { items: rows.map((row) => this.toAdminStock(row)) };
  }

  @Post(ADMIN_ROUTES.stocks)
  @Roles(['ADMIN'])
  async create(
    @Body(new ZodValidationPipe(CreateStockSchema)) input: Required<CreateStock>,
    @CurrentActor() actor: Actor,
  ): Promise<AdminStock> {
    const exists = await this.prisma.stock.findUnique({ where: { symbol: input.symbol } });
    if (exists) throw new ConflictException(`Symbol ${input.symbol} already exists`);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stock.create({ data: input });
      await this.audit.log(
        {
          actorEmail: actor.email,
          action: 'stock.create',
          entity: `Stock · ${created.symbol}`,
          payload: input,
          ip: actor.ip,
        },
        tx,
      );
      return created;
    });
    await this.market.reload();
    return this.toAdminStock(row);
  }

  @Patch(ADMIN_ROUTES.stock)
  @Roles(['ADMIN'])
  async update(
    @Param('symbol', new ZodValidationPipe(SymbolSchema)) symbol: string,
    @Body(new ZodValidationPipe(UpdateStockSchema)) changes: UpdateStock,
    @CurrentActor() actor: Actor,
  ): Promise<AdminStock> {
    const row = await this.prisma.$transaction(async (tx) => {
      const before = await tx.stock.findUniqueOrThrow({ where: { symbol } });
      const updated = await tx.stock.update({ where: { symbol }, data: changes });
      const fields = Object.keys(changes) as (keyof UpdateStock)[];
      await this.audit.log(
        {
          actorEmail: actor.email,
          action: 'stock.update',
          entity: `Stock · ${symbol}`,
          payload: {
            symbol,
            before: Object.fromEntries(fields.map((field) => [field, before[field]])),
            after: Object.fromEntries(fields.map((field) => [field, updated[field]])),
          },
          ip: actor.ip,
        },
        tx,
      );
      return updated;
    });
    await this.market.reload();
    return this.toAdminStock(row);
  }

  // Orders, fills and positions are financial history: a traded stock is disabled, never deleted.
  @Delete(ADMIN_ROUTES.stock)
  @Roles(['ADMIN'])
  @HttpCode(204)
  async remove(
    @Param('symbol', new ZodValidationPipe(SymbolSchema)) symbol: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    const [orders, positions, fills] = await Promise.all([
      this.prisma.order.count({ where: { symbol } }),
      this.prisma.position.count({ where: { symbol } }),
      this.prisma.fill.count({ where: { symbol } }),
    ]);
    if (orders + positions + fills > 0) {
      throw new ConflictException({
        code: ErrorCode.Conflict,
        message: 'Disable the stock instead',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.stock.delete({ where: { symbol } });
      await this.audit.log(
        {
          actorEmail: actor.email,
          action: 'stock.delete',
          entity: `Stock · ${symbol}`,
          payload: { symbol },
          ip: actor.ip,
        },
        tx,
      );
    });
    await this.market.reload();
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
