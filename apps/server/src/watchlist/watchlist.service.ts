import { Injectable, NotFoundException } from '@nestjs/common';

import { type WatchlistResponse } from '@sarwa/contracts';

import { PrismaService } from '../prisma.service';

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(deviceId: string): Promise<WatchlistResponse> {
    await this.touchDevice(deviceId);
    const items = await this.prisma.watchlistItem.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'asc' },
      select: { symbol: true },
    });
    return { symbols: items.map((item) => item.symbol) };
  }

  async add(deviceId: string, symbol: string): Promise<void> {
    const stock = await this.prisma.stock.findUnique({
      where: { symbol },
      select: { isEnabled: true },
    });
    if (!stock?.isEnabled) throw new NotFoundException(`Unknown symbol ${symbol}`);
    await this.touchDevice(deviceId);
    await this.prisma.watchlistItem.upsert({
      where: { deviceId_symbol: { deviceId, symbol } },
      update: {},
      create: { deviceId, symbol },
    });
  }

  async remove(deviceId: string, symbol: string): Promise<void> {
    await this.prisma.watchlistItem.deleteMany({ where: { deviceId, symbol } });
  }

  private async touchDevice(id: string): Promise<void> {
    await this.prisma.device.upsert({
      where: { id },
      update: { lastSeenAt: new Date() },
      create: { id },
    });
  }
}
