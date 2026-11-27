import { type MarketState } from '@sarwa/core/pure';

import { cn } from '../lib/cn';

const PILL: Record<MarketState, { box: string; dot: string }> = {
  open: { box: 'bg-pos-subtle', dot: 'bg-pos' },
  closed: { box: 'bg-surface-3', dot: 'border-fg-3 border-2 bg-transparent' },
  pre: { box: 'bg-info-subtle', dot: 'bg-info' },
  post: { box: 'bg-info-subtle', dot: 'bg-info' },
  halted: { box: 'bg-warn-subtle', dot: 'bg-warn' },
  reconnecting: { box: 'bg-surface-3', dot: 'bg-warn animate-blink' },
};

// compact: below 1280 px, where the nav runs out of room, only the dot shows; the label stays
// for screen readers and as a tooltip.
export function MarketStatusPill({
  state,
  label,
  compact = false,
  className,
}: {
  state: MarketState;
  label: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      role="status"
      title={compact ? label : undefined}
      data-state={state}
      className={cn(
        'text-fg inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs leading-none font-semibold whitespace-nowrap',
        PILL[state].box,
        compact && 'max-xl:size-7 max-xl:justify-center max-xl:px-0',
        className,
      )}
    >
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', PILL[state].dot)} />
      <span className={cn(compact && 'max-xl:sr-only')}>{label}</span>
    </span>
  );
}
