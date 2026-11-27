import { randomBytes } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { type Account as AccountRow } from '@prisma/client';

import { POLICY } from '@sarwa/domain';

import { Clock } from '../common/clock';
import { type AccountRef } from '../common/events';
import { PrismaService, type Tx } from '../prisma.service';
import { ExecutionQueue } from './execution-queue';

const newHandle = (): string => `ACC-${randomBytes(3).toString('hex').toUpperCase()}`;

@Injectable()
export class AccountsService {
  // The handle never changes, so it's cached for every event the engine emits.
  private readonly refs = new Map<string, AccountRef>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly queue: ExecutionQueue,
  ) {}

  async get(accountId: string): Promise<AccountRow> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  // A new paper account with the standard starting cash. Runs in the execution queue, so the
  // handle checked here can't be taken before it is written.
  async open(tx: Tx, owner: { userId: string } | { deviceId: string }): Promise<AccountRow> {
    let handle = newHandle();
    while (await tx.account.findUnique({ where: { handle }, select: { id: true } })) {
      handle = newHandle();
    }
    return tx.account.create({
      data: {
        ...owner,
        handle,
        cashCents: BigInt(POLICY.startingCashCents),
        createdAt: new Date(this.clock.now()),
      },
    });
  }

  // A guest's account lives on their device; it is opened only when `create` asks for it.
  forDevice(deviceId: string, { create }: { create: boolean }): Promise<AccountRow | null> {
    return this.queue.run(() =>
      this.prisma.$transaction(async (tx) => {
        const now = new Date(this.clock.now());
        await tx.device.upsert({
          where: { id: deviceId },
          update: { lastSeenAt: now },
          create: { id: deviceId, createdAt: now, lastSeenAt: now },
        });
        const account = await tx.account.findUnique({ where: { deviceId } });
        if (account || !create) return account;
        return this.open(tx, { deviceId });
      }),
    );
  }

  async ref(accountId: string): Promise<AccountRef> {
    const cached = this.refs.get(accountId);
    if (cached) return cached;
    const { handle } = await this.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { handle: true },
    });
    const ref = { accountId, handle };
    this.refs.set(accountId, ref);
    return ref;
  }
}
