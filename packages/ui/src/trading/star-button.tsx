import { Star } from 'lucide-react';

import { type StarSize } from '@sarwa/tokens';

import { cn } from '../lib/cn';

export function StarButton({
  label,
  watched,
  onToggle,
  size = 44,
  className,
}: {
  label: string;
  watched: boolean;
  onToggle: () => void;
  size?: StarSize;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={watched}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        'text-fg-3 ease-spring inline-grid shrink-0 cursor-pointer place-items-center transition-[transform,background-color,color] duration-200',
        'hover:bg-surface-3 hover:text-fg-2 active:scale-86',
        'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
        size === 44 ? 'rounded-control-lg size-11' : 'size-9 rounded-md',
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
