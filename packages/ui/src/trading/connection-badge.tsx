import { LIVE_STATUS_LABELS, type LiveStatus } from '@sarwa/core';

import { cn } from '../lib/cn';

export function ConnectionBadge({
  status,
  label = LIVE_STATUS_LABELS[status],
  className,
}: {
  status: LiveStatus;
  label?: string;
  className?: string;
}) {
  const waiting = status === 'reconnecting' || status === 'connecting';
  return (
    <span
      role="status"
      className={cn(
        'border-border bg-surface gap-conn-gap pl-conn-start inline-flex h-7 items-center whitespace-nowrap rounded-full border pr-2.5 text-xs font-semibold leading-none',
        status === 'live' && 'text-pos',
        waiting && 'text-warn',
        status === 'offline' && 'text-fg-3',
        status === 'paused' && 'text-info',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full bg-current',
          status === 'live' && 'animate-live-pulse',
          waiting && 'animate-blink',
          status === 'offline' && 'border-2 border-current bg-transparent',
          status === 'paused' &&
            'rounded-[1px] bg-[linear-gradient(90deg,currentColor_0_35%,transparent_35%_65%,currentColor_65%)]',
        )}
      />
      <span className={cn('text-fg', className)}>{label}</span>
    </span>
  );
}
