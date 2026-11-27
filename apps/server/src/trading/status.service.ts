import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { merge, type Subscription } from 'rxjs';

import { type AdminTrading, type CalendarDay, type TradingStatus } from '@sarwa/contracts';
import { addDays, marketClock, marketSession, marketTime, NYSE_CALENDAR } from '@sarwa/domain';

import { AdminGateway } from '../admin/admin.gateway';
import { Clock } from '../common/clock';
import { TradingConfigService } from '../trading-config/trading-config.service';
import { CircuitBreaker } from './circuit-breaker';
import { HaltsService } from './halts.service';
import { TradingGateway } from './trading.gateway';

const UPCOMING_DAYS = 30;

@Injectable()
export class StatusService implements OnModuleInit, OnModuleDestroy {
  private subscription?: Subscription;

  constructor(
    private readonly clock: Clock,
    private readonly config: TradingConfigService,
    private readonly halts: HaltsService,
    private readonly breaker: CircuitBreaker,
    private readonly gateway: TradingGateway,
    private readonly adminGateway: AdminGateway,
  ) {}

  onModuleInit(): void {
    this.subscription = merge(this.config.changes$, this.halts.changes$).subscribe(() => {
      this.publish();
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  status(): TradingStatus {
    const now = this.clock.now();
    const { tradingEnabled, sessionMode, rules } = this.config.get();
    return {
      tradingEnabled,
      sessionMode,
      session: marketSession(now, sessionMode),
      rules,
      halts: this.halts.list(),
      upcoming: upcomingDays(now),
      updatedAt: now,
    };
  }

  admin(): AdminTrading {
    const { circuitBreaker, changedBy, changedAt } = this.config.get();
    return {
      ...this.status(),
      circuitBreaker,
      tripsToday: this.breaker.tripsToday(this.clock.now()),
      changedBy,
      changedAt,
    };
  }

  publish(): void {
    this.gateway.tradingStatus(this.status());
    this.adminGateway.trading(this.admin());
  }
}

function upcomingDays(now: number): CalendarDay[] {
  const today = marketClock(now).date;
  const days: CalendarDay[] = [];
  for (let i = 0; i < UPCOMING_DAYS; i++) {
    const date = addDays(today, i);
    const holiday = NYSE_CALENDAR.holidays[date];
    const earlyClose = NYSE_CALENDAR.earlyCloses[date];
    if (holiday) days.push({ date, kind: 'holiday', label: holiday, closesAt: null });
    else if (earlyClose !== undefined) {
      days.push({
        date,
        kind: 'early_close',
        label: 'Early close',
        closesAt: marketTime(date, earlyClose),
      });
    }
  }
  return days;
}
