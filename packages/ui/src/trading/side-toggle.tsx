import { type KeyboardEvent } from 'react';

import { cn } from '../lib/cn';

export type OrderSide = 'buy' | 'sell';

const SIDE_CHECKED: Record<OrderSide, string> = {
  buy: 'bg-brand text-on-brand',
  sell: 'bg-fg text-bg',
};

export function SideToggle({
  value,
  onChange,
  label,
  buyLabel,
  sellLabel,
  sellSuffix,
  className,
}: {
  value: OrderSide;
  onChange: (side: OrderSide) => void;
  label: string;
  buyLabel: string;
  sellLabel: string;
  sellSuffix?: string;
  className?: string;
}) {
  const sides: readonly { side: OrderSide; text: string }[] = [
    { side: 'buy', text: buyLabel },
    { side: 'sell', text: sellSuffix ? `${sellLabel} · ${sellSuffix}` : sellLabel },
  ];

  // Two options, so every arrow key (in either reading direction) flips the side.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const next: OrderSide = value === 'buy' ? 'sell' : 'buy';
    onChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-side="${next}"]`)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'bg-surface-3 rounded-control-lg p-seg-pad gap-seg-pad grid grid-cols-2',
        className,
      )}
    >
      {sides.map(({ side, text }) => {
        const checked = side === value;
        return (
          <button
            key={side}
            type="button"
            role="radio"
            data-side={side}
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => {
              onChange(side);
            }}
            className={cn(
              'type-button h-seg-lg rounded-pill-lg cursor-pointer truncate px-3 transition-colors duration-200',
              'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
              checked ? SIDE_CHECKED[side] : 'text-fg-2 hover:text-fg bg-transparent',
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
