import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import {
  type NotificationPayload,
  type NotificationsQuery,
  type NotificationsResponse,
  type PushTokenRequest,
} from '@sarwa/contracts';

import { Clock } from '../common/clock';
import { PrismaService } from '../prisma.service';
import { AccountsService } from './accounts.service';
import { toNotification } from './mappers';
import { pushMessage, PushSender } from './push';
import { TradingGateway } from './trading.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly accounts: AccountsService,
    private readonly gateway: TradingGateway,
    private readonly push: PushSender,
  ) {}

  async notify(accountIds: readonly string[], payload: NotificationPayload): Promise<void> {
    for (const accountId of new Set(accountIds)) {
      const row = await this.prisma.notification.create({
        data: {
          accountId,
          payload: JSON.stringify(payload),
          createdAt: new Date(this.clock.now()),
        },
      });
      const { deviceId } = await this.accounts.ref(accountId);
      this.gateway.notification(deviceId, toNotification(row));
      void this.sendPush(deviceId, payload);
    }
  }

  async list(accountId: string, query: NotificationsQuery): Promise<NotificationsResponse> {
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { accountId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      }),
      this.prisma.notification.count({ where: { accountId, readAt: null } }),
    ]);
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(toNotification),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
      unreadCount,
    };
  }

  async markRead(accountId: string, id: string): Promise<void> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, accountId, readAt: null },
      data: { readAt: new Date(this.clock.now()) },
    });
    if (count === 0 && !(await this.prisma.notification.findFirst({ where: { id, accountId } }))) {
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(accountId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { accountId, readAt: null },
      data: { readAt: new Date(this.clock.now()) },
    });
  }

  async registerToken(deviceId: string, { token, platform }: PushTokenRequest): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { deviceId, platform },
      create: { token, deviceId, platform },
    });
  }

  // Best effort: a push that fails never blocks or fails the trade that caused it.
  private async sendPush(deviceId: string, payload: NotificationPayload): Promise<void> {
    try {
      const targets = await this.prisma.pushToken.findMany({ where: { deviceId } });
      if (targets.length > 0) await this.push.send(targets, pushMessage(payload));
    } catch (error) {
      this.logger.warn(`Push failed: ${String(error)}`);
    }
  }
}
