import {
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Account as AccountRow, type Alert as AlertRow } from '@prisma/client';

import {
  type Alert,
  type AlertsResponse,
  type CreateAlertRequest,
  type UpdateAlertRequest,
} from '@sarwa/contracts';
import {
  type AlertCondition,
  type AlertRepeat,
  type AlertRule,
  bps,
  evaluateAlert,
  POLICY,
  ticks,
  type TradeQuote,
  validateAlert,
} from '@sarwa/domain';

import { Clock } from '../common/clock';
import { MarketService } from '../market/market.service';
import { PrismaService } from '../prisma.service';
import { AccountsService } from './accounts.service';
import { ExecutionQueue } from './execution-queue';
import { toAlert, toTradeQuote } from './mappers';
import { NotificationsService } from './notifications.service';
import { TradingGateway } from './trading.gateway';

const ruleOf = (row: AlertRow): AlertRule => ({
  condition: row.condition as AlertCondition,
  thresholdTicks: row.thresholdTicks === null ? null : ticks(Number(row.thresholdTicks)),
  thresholdBps: row.thresholdBps === null ? null : bps(row.thresholdBps),
});

@Injectable()
export class AlertsService implements OnModuleInit {
  // Enabled alerts by symbol, so each quote only evaluates its own.
  private readonly bySymbol = new Map<string, Map<string, AlertRow>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly queue: ExecutionQueue,
    private readonly market: MarketService,
    private readonly accounts: AccountsService,
    private readonly notifications: NotificationsService,
    private readonly gateway: TradingGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    const rows = await this.prisma.alert.findMany({ where: { enabled: true } });
    for (const row of rows) this.index(row);
  }

  async list(account: AccountRow): Promise<AlertsResponse> {
    const rows = await this.prisma.alert.findMany({
      where: { accountId: account.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return {
      items: rows.map(toAlert),
      activeCount: rows.filter((row) => row.enabled).length,
      limit: POLICY.maxActiveAlerts,
    };
  }

  create(account: AccountRow, request: CreateAlertRequest): Promise<Alert> {
    return this.queue.run(async () => {
      await this.assertBelowLimit(account.id);
      const rule: AlertRule = {
        condition: request.condition,
        thresholdTicks: request.thresholdTicks === undefined ? null : ticks(request.thresholdTicks),
        thresholdBps: request.thresholdBps === undefined ? null : bps(request.thresholdBps),
      };
      this.assertNotAlreadyMet(rule, request.symbol);
      const row = await this.prisma.alert.create({
        data: {
          accountId: account.id,
          symbol: request.symbol,
          condition: rule.condition,
          thresholdTicks: rule.thresholdTicks === null ? null : BigInt(rule.thresholdTicks),
          thresholdBps: rule.thresholdBps,
          repeat: request.repeat,
          createdAt: new Date(this.clock.now()),
        },
      });
      this.index(row);
      return toAlert(row);
    });
  }

  update(account: AccountRow, id: string, patch: UpdateAlertRequest): Promise<Alert> {
    return this.queue.run(async () => {
      const current = await this.owned(account, id);
      const enabling = patch.enabled === true && !current.enabled;
      if (enabling) {
        await this.assertBelowLimit(account.id);
        this.assertNotAlreadyMet(ruleOf(current), current.symbol);
      }
      const row = await this.prisma.alert.update({
        where: { id },
        data: { enabled: patch.enabled, repeat: patch.repeat, ...(enabling && { armed: true }) },
      });
      this.index(row);
      return toAlert(row);
    });
  }

  remove(account: AccountRow, id: string): Promise<void> {
    return this.queue.run(async () => {
      const row = await this.owned(account, id);
      await this.prisma.alert.delete({ where: { id } });
      this.bySymbol.get(row.symbol)?.delete(id);
    });
  }

  // Runs in the execution queue for every processed quote.
  async evaluate(symbol: string, quote: TradeQuote, now: number): Promise<void> {
    for (const row of [...(this.bySymbol.get(symbol)?.values() ?? [])]) {
      const state = {
        repeat: row.repeat as AlertRepeat,
        armed: row.armed,
        lastFiredAt: row.lastFiredAt?.getTime() ?? null,
      };
      const result = evaluateAlert(ruleOf(row), state, quote, now);
      if (!result.fire && result.state.armed === state.armed) continue;

      const updated = await this.prisma.alert.update({
        where: { id: row.id },
        data: {
          armed: result.state.armed,
          lastFiredAt:
            result.state.lastFiredAt === null ? null : new Date(result.state.lastFiredAt),
          ...(result.fire && row.repeat === 'once' && { enabled: false }),
        },
      });
      this.index(updated);
      if (result.fire) await this.announce(updated, quote.lastTicks);
    }
  }

  private async announce(row: AlertRow, lastTicks: number): Promise<void> {
    const alert = toAlert(row);
    const { deviceId } = await this.accounts.ref(row.accountId);
    this.gateway.alertTriggered(deviceId, alert, lastTicks);
    await this.notifications.notify([row.accountId], {
      kind: 'alert_triggered',
      alertId: alert.id,
      symbol: alert.symbol,
      condition: alert.condition,
      thresholdTicks: alert.thresholdTicks,
      thresholdBps: alert.thresholdBps,
      lastTicks,
    });
  }

  private index(row: AlertRow): void {
    let alerts = this.bySymbol.get(row.symbol);
    if (!alerts) this.bySymbol.set(row.symbol, (alerts = new Map<string, AlertRow>()));
    if (row.enabled) alerts.set(row.id, row);
    else alerts.delete(row.id);
  }

  private async assertBelowLimit(accountId: string): Promise<void> {
    const active = await this.prisma.alert.count({ where: { accountId, enabled: true } });
    if (active >= POLICY.maxActiveAlerts) {
      throw new ConflictException({
        code: 'ALERT_LIMIT',
        message: `At most ${POLICY.maxActiveAlerts} active alerts`,
      });
    }
  }

  // An alert that is already true would fire the moment it's saved.
  private assertNotAlreadyMet(rule: AlertRule, symbol: string): void {
    const found = this.market.find(symbol);
    if (!found) throw new NotFoundException(`Unknown symbol ${symbol}`);
    const issue = validateAlert(rule, toTradeQuote(found.quote));
    if (issue) {
      throw new UnprocessableEntityException({
        code: issue.code,
        message: `This alert can't be saved (${issue.code})`,
      });
    }
  }

  private async owned(account: AccountRow, id: string): Promise<AlertRow> {
    const row = await this.prisma.alert.findFirst({ where: { id, accountId: account.id } });
    if (!row) throw new NotFoundException('Alert not found');
    return row;
  }
}
