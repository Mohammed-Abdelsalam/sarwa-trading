import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import {
  type NotificationPayload,
  type NotificationsQuery,
  type NotificationsResponse,
  type Order,
  type PushTokenRequest,
} from '@sarwa/contracts';

import { Clock } from '../common/clock';
import { EventBus } from '../common/events';
import { PrismaService } from '../prisma.service';
import { ExecutionQueue } from './execution-queue';
import { toNotification } from './mappers';
import { pushMessage, PushSender } from './push';
import { TradingGateway } from './trading.gateway';

const BATCH_SIZE = 500;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly queue: ExecutionQueue,
    private readonly gateway: TradingGateway,
    private readonly push: PushSender,
    events: EventBus,
  ) {
    events.on('order.changed').subscribe(({ account, order, notice }) => {
      if (notice) this.enqueue([account.accountId], orderNotice(notice, order));
    });
    events.on('alert.fired').subscribe(({ account, alert, lastTicks }) => {
      this.enqueue([account.accountId], {
        kind: 'alert_triggered',
        alertId: alert.id,
        symbol: alert.symbol,
        condition: alert.condition,
        thresholdTicks: alert.thresholdTicks,
        thresholdBps: alert.thresholdBps,
        lastTicks,
      });
    });
  }

  // Delivered as its own queue task, so a fan-out never holds up the fill or halt that caused it.
  enqueue(accountIds: readonly string[], payload: NotificationPayload): void {
    this.queue
      .run(() => this.notify(accountIds, payload))
      .catch((error: unknown) => {
        this.logger.error(`Notification failed: ${String(error)}`);
      });
  }

  // Batched, so a halt or market notice to every account stays a handful of queries.
  async notify(accountIds: readonly string[], payload: NotificationPayload): Promise<void> {
    const ids = [...new Set(accountIds)];
    for (let start = 0; start < ids.length; start += BATCH_SIZE) {
      await this.notifyBatch(ids.slice(start, start + BATCH_SIZE), payload);
    }
  }

  private async notifyBatch(accountIds: string[], payload: NotificationPayload): Promise<void> {
    const createdAt = new Date(this.clock.now());
    const json = JSON.stringify(payload);
    const [rows, accounts] = await Promise.all([
      this.prisma.notification.createManyAndReturn({
        data: accountIds.map((accountId) => ({ accountId, payload: json, createdAt })),
      }),
      this.prisma.account.findMany({
        where: { id: { in: accountIds } },
        select: { id: true, deviceId: true },
      }),
    ]);
    const deviceOf = new Map(accounts.map((account) => [account.id, account.deviceId]));
    for (const row of rows) {
      const deviceId = deviceOf.get(row.accountId);
      if (deviceId) this.gateway.notification(deviceId, toNotification(row));
    }
    void this.sendPush([...deviceOf.values()], payload);
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
  private async sendPush(deviceIds: string[], payload: NotificationPayload): Promise<void> {
    try {
      const targets = await this.prisma.pushToken.findMany({
        where: { deviceId: { in: deviceIds } },
      });
      if (targets.length > 0) await this.push.send(targets, pushMessage(payload));
    } catch (error) {
      this.logger.warn(`Push failed: ${String(error)}`);
    }
  }
}

function orderNotice(kind: NotificationPayload['kind'], order: Order): NotificationPayload {
  const base = { orderId: order.id, symbol: order.symbol, side: order.side };
  if (kind === 'order_rejected' && order.rejection) {
    return { kind, ...base, rejection: order.rejection };
  }
  const last = order.fills.at(-1);
  const partial = kind === 'order_partially_filled' && last;
  return {
    kind: kind as 'order_filled' | 'order_partially_filled' | 'order_expired' | 'order_canceled',
    ...base,
    qtyMicros: partial ? last.qtyMicros : order.filledMicros,
    priceTicks: partial ? last.priceTicks : order.avgFillTicks,
    notionalCents: partial ? last.notionalCents : order.filledNotionalCents,
  };
}
