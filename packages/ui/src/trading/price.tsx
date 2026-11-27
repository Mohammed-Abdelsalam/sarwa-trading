import { useState } from 'react';

import { type Direction, formatPrice } from '@sarwa/core';
import { type PriceSize } from '@sarwa/tokens';

import { cn } from '../lib/cn';

const PRICE_SIZES: Record<PriceSize, string> = {
  display: 'type-display',
  'display-web': 'type-display-web',
  lg: 'type-num-lg',
  md: 'type-num-md',
  sm: 'type-num-sm',
};

export function PriceText({
  value,
  size = 'md',
  className,
}: {
  value: number;
  size?: PriceSize;
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
  format = formatPrice,
  muted = false,
  className,
}: {
  price: number;
  size?: PriceSize;
  format?: (price: number) => string;
  muted?: boolean;
  className?: string;
}) {
  const { direction, key } = usePriceFlash(price);
  return (
    <span
      key={key}
      className={cn(
        PRICE_SIZES[size],
        '-mx-1.5 -my-px inline-block rounded-sm px-1.5 py-px',
        muted ? 'text-fg-2' : 'text-fg',
        direction === 'up' && 'animate-flash-up',
        direction === 'down' && 'animate-flash-down',
        className,
      )}
    >
      {format(price)}
    </span>
  );
}
