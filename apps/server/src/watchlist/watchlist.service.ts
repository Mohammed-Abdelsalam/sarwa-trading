import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { ErrorCode, type WatchlistResponse } from '@sarwa/contracts';

import { PrismaService } from '../prisma.service';

// A guest account costs nothing to make, so its stars are capped against abuse.
export const GUEST_WATCHLIST_LIMIT = 50;

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(accountId: string): Promise<WatchlistResponse> {
    const items = await this.prisma.watchlistItem.findMany({
      where: { accountId },
      orderBy: { createdAt: 'asc' },
      select: { symbol: true },
    });
    return { symbols: items.map((item) => item.symbol) };
  }

  async add(accountId: string, symbol: string, limit?: number): Promise<void> {
    const stock = await this.prisma.stock.findUnique({
      where: { symbol },
      select: { isEnabled: true },
    });
    if (!stock?.isEnabled) throw new NotFoundException(`Unknown symbol ${symbol}`);
    if (limit !== undefined) await this.assertRoom(accountId, symbol, limit);
    await this.prisma.watchlistItem.upsert({
      where: { accountId_symbol: { accountId, symbol } },
      update: {},
      create: { accountId, symbol },
    });
  }

  async remove(accountId: string, symbol: string): Promise<void> {
    await this.prisma.watchlistItem.deleteMany({ where: { accountId, symbol } });
  }

  private async assertRoom(accountId: string, symbol: string, limit: number): Promise<void> {
    const others = await this.prisma.watchlistItem.count({
      where: { accountId, symbol: { not: symbol } },
    });
    if (others >= limit) {
      throw new ConflictException({
        code: ErrorCode.TooManySymbols,
        message: `At most ${String(limit)} stars without an account`,
      });
    }
  }
}
