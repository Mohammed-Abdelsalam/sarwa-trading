import { Logger } from '@nestjs/common';

import { type NotificationPayload } from '@sarwa/contracts';
import {
  cents,
  centsToDollars,
  micros,
  microsToShares,
  ticks,
  ticksToDollars,
} from '@sarwa/domain';

import { env } from '../env';

export interface PushTarget {
  token: string;
  platform: string;
}

export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export abstract class PushSender {
  abstract send(targets: PushTarget[], message: PushMessage): Promise<void>;
}

export class LogPushSender extends PushSender {
  private readonly logger = new Logger('Push');

  send(targets: PushTarget[], message: PushMessage): Promise<void> {
    if (targets.length > 0) this.logger.debug(`${message.title} → ${targets.length} device(s)`);
    return Promise.resolve();
  }
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo accepts at most 100 messages per request; a stalled request must not pile up.
const EXPO_BATCH_SIZE = 100;
const EXPO_TIMEOUT_MS = 5_000;

export class ExpoPushSender extends PushSender {
  private readonly logger = new Logger('ExpoPush');
  private readonly fallback = new LogPushSender();

  async send(targets: PushTarget[], message: PushMessage): Promise<void> {
    const mobile = targets.filter((t) => t.platform === 'ios' || t.platform === 'android');
    await this.fallback.send(
      targets.filter((t) => !mobile.includes(t)),
      message,
    );
    for (let start = 0; start < mobile.length; start += EXPO_BATCH_SIZE) {
      const batch = mobile.slice(start, start + EXPO_BATCH_SIZE);
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(
          batch.map(({ token }) => ({ to: token, sound: 'default', ...message })),
        ),
        signal: AbortSignal.timeout(EXPO_TIMEOUT_MS),
      });
      if (!response.ok) this.logger.warn(`Expo push failed with ${response.status}`);
    }
  }
}

// Tests never reach the network.
export const pushSenderProvider = {
  provide: PushSender,
  useFactory: (): PushSender =>
    env.NODE_ENV === 'test' ? new LogPushSender() : new ExpoPushSender(),
};

const shares = (qty: number): string => String(microsToShares(micros(qty)));
const dollars = (price: number): string => `$${ticksToDollars(ticks(price)).toFixed(2)}`;
const money = (amount: number): string => `$${centsToDollars(cents(amount)).toFixed(2)}`;

// Lock-screen text only; in-app notifications are rendered from the payload in the user's language.
export function pushMessage(payload: NotificationPayload): PushMessage {
  const data = { ...payload };
  switch (payload.kind) {
    case 'order_filled':
    case 'order_partially_filled': {
      const what = payload.kind === 'order_filled' ? 'filled' : 'partially filled';
      return {
        title: `${payload.symbol} ${payload.side} ${what}`,
        body: `${shares(payload.qtyMicros)} shares for ${money(payload.notionalCents)}`,
        data,
      };
    }
    case 'order_expired':
    case 'order_canceled':
      return {
        title: `${payload.symbol} ${payload.side} ${payload.kind === 'order_expired' ? 'expired' : 'canceled'}`,
        body: `${shares(payload.qtyMicros)} shares filled before it closed`,
        data,
      };
    case 'order_rejected':
      return {
        title: `${payload.symbol} ${payload.side} rejected`,
        body: payload.rejection.code.replaceAll('_', ' ').toLowerCase(),
        data,
      };
    case 'alert_triggered':
      return {
        title: `${payload.symbol} alert`,
        body: `Now ${dollars(payload.lastTicks)}`,
        data,
      };
    case 'symbol_halted':
      return { title: `${payload.symbol} halted`, body: payload.message, data };
    case 'market_notice':
      return { title: 'Market notice', body: payload.message, data };
    case 'welcome':
      return {
        title: 'Your $100,000 practice account is ready',
        body: 'Place your first trade',
        data,
      };
  }
}
