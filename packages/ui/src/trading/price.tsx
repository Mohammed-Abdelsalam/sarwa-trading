import { useState } from 'react';

import { type Direction, formatPrice } from '@sarwa/core';

import { cn } from '../lib/cn';

const PRICE_SIZES = {
  display: 'type-display',
  'display-web': 'type-display-web',
  lg: 'type-num-lg',
  md: 'type-num-md',
  sm: 'type-num-sm',
} as const;

export function PriceText({
  value,
  size = 'md',
  className,
}: {
  value: number;
  size?: keyof typeof PRICE_SIZES;
  className?: string;
}) {
  return <span className={cn(PRICE_SIZES[size], 'text-fg', className)}>{formatPrice(value)}</span>;
}

export function usePriceFlash(price: number): { direction: Direction | null; key: number } {
  const [previous, setPrevious] = useState(price);
  const [flash, setFlash] = useState<{ direction: Direction | null; key: number }>({
    direction: null,
    key: 0,
  });
  // Derived during render (React's "store previous value" pattern) instead of an effect.
  if (price !== previous) {
    setPrevious(price);
    setFlash({ direction: price > previous ? 'up' : 'down', key: flash.key + 1 });
  }
  return flash;
}

export function PriceFlash({
  price,
  size = 'md',
  className,
}: {
  price: number;
  size?: keyof typeof PRICE_SIZES;
  className?: string;
}) {
  const { direction, key } = usePriceFlash(price);
  return (
    <span
      key={key}
      className={cn(
        PRICE_SIZES[size],
        'text-fg -mx-1.5 -my-px inline-block rounded-sm px-1.5 py-px',
        direction === 'up' && 'animate-flash-up',
        direction === 'down' && 'animate-flash-down',
        className,
      )}
    >
      {formatPrice(price)}
    </span>
  );
}
