import { Star } from 'lucide-react';

import { cn } from '../lib/cn';

export function StarButton({
  symbol,
  watched,
  onToggle,
  size = 'md',
  className,
}: {
  symbol: string;
  watched: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={watched}
      aria-label={watched ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        'text-fg-3 ease-spring inline-grid shrink-0 cursor-pointer place-items-center transition-[transform,background-color,color] duration-200',
        'hover:bg-surface-3 hover:text-fg-2 active:scale-[0.86]',
        'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
        size === 'md' ? 'size-11 rounded-[12px]' : 'size-9 rounded-md',
        watched && 'text-star hover:text-star',
        className,
      )}
    >
      <Star
        key={String(watched)}
        aria-hidden
        className={cn('size-5', watched && 'animate-star-pop fill-current')}
      />
    </button>
  );
}
