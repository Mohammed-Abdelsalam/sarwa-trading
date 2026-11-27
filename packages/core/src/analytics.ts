import { type OrderType, type RejectionCode, type Side } from '@sarwa/domain';

export type TicketSource = 'detail' | 'portfolio' | 'shortcut' | 'palette' | 'deep_link' | 'alert';

// The event catalogue: adding an event means adding it here, so names and props can't drift.
export type AnalyticsEvent =
  | { name: 'ticket_opened'; side: Side; source: TicketSource }
  | { name: 'order_submitted'; side: Side; type: OrderType; sizeKind: 'amount' | 'shares' | 'all' }
  | { name: 'order_filled'; side: Side; type: OrderType; slippageBps: number }
  | { name: 'order_rejected'; code: RejectionCode }
  | { name: 'order_canceled'; outcome: 'canceled' | 'already_filled' | 'already_closed' }
  | { name: 'trading_blocked'; reason: RejectionCode | 'CONNECTION_NOT_LIVE' }
  | { name: 'alert_created'; condition: string; repeat: string }
  | { name: 'notifications_read'; count: number };

export interface AnalyticsProvider {
  track: (event: AnalyticsEvent) => void;
}

export const noopAnalytics: AnalyticsProvider = { track: () => undefined };
