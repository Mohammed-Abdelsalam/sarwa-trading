import { Global, Injectable, Module } from '@nestjs/common';
import { filter, type Observable, Subject } from 'rxjs';

import {
  type AdminTrading,
  type Alert,
  type Halt,
  type NotificationPayload,
  type Order,
  type SessionRevokedReason,
  type Suspension,
  type TradingStatus,
} from '@sarwa/contracts';

export interface AccountRef {
  accountId: string;
  handle: string;
}

export type DomainEvent =
  | {
      type: 'order.changed';
      account: AccountRef;
      order: Order;
      latencyMs: number;
      notice?: NotificationPayload['kind'];
    }
  | { type: 'alert.fired'; account: AccountRef; alert: Alert; lastTicks: number }
  | { type: 'account.reset'; account: AccountRef }
  | { type: 'trading.changed'; status: TradingStatus; admin: AdminTrading }
  | { type: 'symbol.halted'; halt: Halt }
  | { type: 'symbol.resumed'; symbol: string; at: number }
  | {
      type: 'session.revoked';
      userId: string;
      sessionIds: string[];
      reason: SessionRevokedReason;
      suspension?: Suspension;
    };

export type EventOf<T extends DomainEvent['type']> = Extract<DomainEvent, { type: T }>;

// Services say what happened; gateways and notifications decide who hears about it.
@Injectable()
export class EventBus {
  private readonly events = new Subject<DomainEvent>();

  publish(event: DomainEvent): void {
    this.events.next(event);
  }

  on<T extends DomainEvent['type']>(type: T): Observable<EventOf<T>> {
    return this.events.pipe(filter((event): event is EventOf<T> => event.type === type));
  }
}

@Global()
@Module({ providers: [EventBus], exports: [EventBus] })
export class EventsModule {}
