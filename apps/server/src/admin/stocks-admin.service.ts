import { ConflictException, Injectable } from '@nestjs/common';
import { type Stock as StockRow } from '@prisma/client';

import {
  type AdminStock,
  type AdminStocksResponse,
  type CreateStock,
  ErrorCode,
  type UpdateStock,
} from '@sarwa/contracts';

import { MarketService } from '../market/market.service';
import { PrismaService } from '../prisma.service';
import { type Actor, AuditService } from './audit.service';

@Injectable()
export class StocksAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly market: MarketService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AdminStocksResponse> {
    const rows = await this.prisma.stock.findMany({ orderBy: { symbol: 'asc' } });
    return { items: rows.map((row) => this.toAdminStock(row)) };
  }

  async create(input: Required<CreateStock>, actor: Actor): Promise<AdminStock> {
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

  async update(symbol: string, changes: UpdateStock, actor: Actor): Promise<AdminStock> {
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
  async remove(symbol: string, actor: Actor): Promise<void> {
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
