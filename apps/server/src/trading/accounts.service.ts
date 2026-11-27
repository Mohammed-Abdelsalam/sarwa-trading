import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { type Account as AccountRow, Prisma } from '@prisma/client';

import { POLICY } from '@sarwa/domain';

import { Clock } from '../common/clock';
import { PrismaService } from '../prisma.service';

export interface AccountRef {
  deviceId: string;
  handle: string;
}

const newHandle = (): string => `ACC-${randomBytes(3).toString('hex').toUpperCase()}`;

@Injectable()
export class AccountsService {
  // Device and handle never change, so they're cached for every event the engine emits.
  private readonly refs = new Map<string, AccountRef>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  // Opened lazily on a device's first trading request, with the standard starting cash.
  async forDevice(deviceId: string): Promise<AccountRow> {
    const existing = await this.prisma.account.findUnique({ where: { deviceId } });
    if (existing) return existing;

    await this.prisma.device.upsert({
      where: { id: deviceId },
      update: { lastSeenAt: new Date(this.clock.now()) },
      create: { id: deviceId },
    });
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.account.create({
          data: {
            deviceId,
            handle: newHandle(),
            cashCents: BigInt(POLICY.startingCashCents),
            createdAt: new Date(this.clock.now()),
          },
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
        // Either a concurrent first request created it, or the random handle collided.
        const raced = await this.prisma.account.findUnique({ where: { deviceId } });
        if (raced) return raced;
      }
    }
    throw new Error('Could not allocate an account handle');
  }

  async ref(accountId: string): Promise<AccountRef> {
    const cached = this.refs.get(accountId);
    if (cached) return cached;
    const { deviceId, handle } = await this.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { deviceId: true, handle: true },
    });
    const ref = { deviceId, handle };
    this.refs.set(accountId, ref);
    return ref;
  }
}
