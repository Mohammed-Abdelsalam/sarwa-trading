import { type Messages, type OrderStatus } from '@sarwa/core/pure';
import { type BadgeTone } from '@sarwa/tokens';

import { Badge } from '../primitives/feedback';

export type OrderBadgeStatus = OrderStatus | 'sending';
export type AlertBadgeStatus = keyof Messages['alerts']['states'];

// Records, not partial maps: a new status or a typo fails to compile instead of rendering neutral.
export const ORDER_STATUS_TONES: Record<OrderBadgeStatus, BadgeTone> = {
  queued: 'brand',
  open: 'info',
  partially_filled: 'warn',
  filled: 'pos',
  canceled: 'neutral',
  rejected: 'neg',
  expired: 'outline',
  sending: 'outline',
};

export const ALERT_STATUS_TONES: Record<AlertBadgeStatus, BadgeTone> = {
  active: 'pos',
  paused: 'neutral',
  triggered: 'brand',
};

const TONES: Record<OrderBadgeStatus | AlertBadgeStatus, BadgeTone> = {
  ...ORDER_STATUS_TONES,
  ...ALERT_STATUS_TONES,
};

export function StatusBadge({
  status,
  label,
  square,
  className,
}: {
  status: OrderBadgeStatus | AlertBadgeStatus;
  label: string;
  square?: boolean;
  className?: string;
}) {
  return (
    <Badge tone={TONES[status]} square={square} data-status={status} className={className}>
      {label}
    </Badge>
  );
}
