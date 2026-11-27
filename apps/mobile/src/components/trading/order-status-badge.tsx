import { type Order } from '@sarwa/contracts';
import { type BadgeTone } from '@sarwa/tokens';

import { useCopy } from '../../lib/i18n';
import { Badge } from '../ui/badge';

type Status = Order['status'] | 'sending';

const TONE: Record<Status, BadgeTone> = {
  sending: 'outline',
  queued: 'brand',
  open: 'info',
  partially_filled: 'warn',
  filled: 'pos',
  canceled: 'neutral',
  rejected: 'neg',
  expired: 'outline',
};

export function OrderStatusBadge({ status }: { status: Status }) {
  const { t } = useCopy();
  return <Badge label={t.orderStatus[status]} tone={TONE[status]} />;
}

export function SideBadge({ side }: { side: Order['side'] }) {
  const { t } = useCopy();
  return (
    <Badge
      square
      label={side === 'buy' ? t.common.buy : t.common.sell}
      tone={side === 'buy' ? 'brand' : 'outline'}
    />
  );
}
