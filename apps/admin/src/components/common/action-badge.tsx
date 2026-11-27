import { type CustomerActivityAction } from '@sarwa/contracts';
import { type BadgeTone } from '@sarwa/tokens';
import { Badge, cn } from '@sarwa/ui';

const TONES: Partial<Record<CustomerActivityAction, BadgeTone>> = {
  'connections.drop': 'neg',
  'customer.suspend': 'neg',
  'customer.deleted': 'neg',
  'market.pause': 'warn',
  'halt.create': 'warn',
  'auth.login_failed': 'warn',
  'customer.signout_all': 'warn',
  'customer.delete_requested': 'warn',
  'customer.signup': 'pos',
  'customer.reactivate': 'pos',
  'order.filled': 'pos',
  'email.verified': 'pos',
  'config.update': 'info',
  'customer.reset_password_sent': 'info',
  'customer.pii_viewed': 'info',
  'customer.export': 'info',
};

export function actionTone(action: CustomerActivityAction): BadgeTone {
  const tone = TONES[action];
  if (tone) return tone;
  if (action.endsWith('.delete')) return 'neg';
  if (action.endsWith('.create') || action.endsWith('.resume')) return 'pos';
  if (action.startsWith('auth.')) return 'info';
  return 'brand';
}

export function ActionBadge({
  action,
  className,
}: {
  action: CustomerActivityAction;
  className?: string;
}) {
  return (
    <Badge square tone={actionTone(action)} className={cn('type-mono font-medium', className)}>
      {action}
    </Badge>
  );
}
