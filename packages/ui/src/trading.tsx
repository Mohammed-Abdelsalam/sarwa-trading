import { Star } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

import { type Period, PERIODS, type Sector } from '@sarwa/contracts';
import {
  type Direction,
  DIRECTION_ARROW,
  direction as toDirection,
  formatPrice,
} from '@sarwa/core';

import { cn } from './cn';

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

const PILL_SIZES = {
  sm: 'h-[22px] min-w-[68px] rounded-sm px-1.5 text-xs',
  md: 'h-[26px] min-w-[78px] rounded-[7px] px-2 text-[13px]',
  lg: 'h-8 rounded-[9px] px-2.5 text-[15px]',
} as const;

const DIRECTION_STYLES: Record<Direction, string> = {
  up: 'bg-pos-subtle text-pos',
  down: 'bg-neg-subtle text-neg',
  flat: 'bg-flat-subtle text-flat',
};

export function ChangePill({
  value,
  label,
  size = 'md',
  className,
}: {
  value: number;
  label: string;
  size?: keyof typeof PILL_SIZES;
  className?: string;
}) {
  const direction = toDirection(value);
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1 leading-none font-semibold whitespace-nowrap tabular-nums',
        PILL_SIZES[size],
        DIRECTION_STYLES[direction],
        className,
      )}
    >
      <span aria-hidden className="text-[0.62em]">
        {DIRECTION_ARROW[direction]}
      </span>
      {label}
    </span>
  );
}

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

export type LiveStatus = 'live' | 'reconnecting' | 'offline' | 'paused';

const LIVE_LABELS: Record<LiveStatus, string> = {
  live: 'Live',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
  paused: 'Market paused',
};

export function ConnectionBadge({
  status,
  label = LIVE_LABELS[status],
  className,
}: {
  status: LiveStatus;
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      className={cn(
        'border-border bg-surface inline-flex h-7 items-center gap-[7px] rounded-full border pr-2.5 pl-[9px] text-xs leading-none font-semibold whitespace-nowrap',
        status === 'live' && 'text-pos',
        status === 'reconnecting' && 'text-warn',
        status === 'offline' && 'text-fg-3',
        status === 'paused' && 'text-info',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full bg-current',
          status === 'live' && 'animate-live-pulse',
          status === 'reconnecting' && 'animate-blink',
          status === 'offline' && 'border-2 border-current bg-transparent',
          status === 'paused' &&
            'rounded-[1px] bg-[linear-gradient(90deg,currentColor_0_35%,transparent_35%_65%,currentColor_65%)]',
        )}
      />
      <span className={cn('text-fg', className)}>{label}</span>
    </span>
  );
}

export function sparklinePath(values: readonly number[], width: number, height: number): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const pad = 2;
  return values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = pad + (1 - (value - min) / range) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join('');
}

const SPARK_STROKE: Record<Direction, string> = {
  up: 'stroke-pos',
  down: 'stroke-neg',
  flat: 'stroke-flat',
};

export function Sparkline({
  values,
  direction,
  width = 60,
  height = 26,
  className,
}: {
  values: readonly number[];
  direction: Direction;
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={className}
    >
      <path
        d={sparklinePath(values, width, height)}
        className={cn('fill-none', SPARK_STROKE[direction])}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PeriodTabs({
  value,
  onChange,
  enabled = PERIODS,
  className,
}: {
  value: Period;
  onChange: (period: Period) => void;
  enabled?: readonly Period[];
  className?: string;
}) {
  const choices = PERIODS.filter((period) => enabled.includes(period));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = choices.indexOf(value);
    const next = {
      ArrowRight: choices[(index + 1) % choices.length],
      ArrowLeft: choices[(index - 1 + choices.length) % choices.length],
      Home: choices[0],
      End: choices.at(-1),
    }[event.key];
    if (!next) return;
    event.preventDefault();
    onChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-period="${next}"]`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Chart period"
      onKeyDown={onKeyDown}
      className={cn('bg-surface-3 inline-flex gap-0.5 rounded-[11px] p-[3px]', className)}
    >
      {PERIODS.map((period) => {
        const selected = period === value;
        const disabled = !enabled.includes(period);
        return (
          <button
            key={period}
            type="button"
            role="tab"
            data-period={period}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => {
              onChange(period);
            }}
            className={cn(
              'text-fg-2 h-8 min-w-11 flex-1 cursor-pointer rounded-[8px] px-2.5 text-[13px] font-semibold tabular-nums transition-colors duration-200',
              'hover:text-fg disabled:cursor-not-allowed disabled:opacity-40',
              'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
              selected && 'bg-surface text-fg shadow-e1 dark:bg-border-strong',
            )}
          >
            {period}
          </button>
        );
      })}
    </div>
  );
}

const AVATAR_SIZES = {
  sm: 'size-8 rounded-[10px] text-[13px]',
  md: 'size-10 rounded-[12px] text-base',
  lg: 'size-14 rounded-[16px] text-[22px]',
} as const;

const SECTOR_STYLES: Record<Sector, string> = {
  tech: 'bg-sector-tech-subtle text-sector-tech',
  fin: 'bg-sector-fin-subtle text-sector-fin',
  energy: 'bg-sector-energy-subtle text-sector-energy',
  health: 'bg-sector-health-subtle text-sector-health',
  consumer: 'bg-sector-consumer-subtle text-sector-consumer',
  media: 'bg-sector-media-subtle text-sector-media',
};

export function StockAvatar({
  symbol,
  sector,
  size = 'md',
  className,
}: {
  symbol: string;
  sector: Sector;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'font-display grid shrink-0 place-items-center leading-none font-extrabold',
        AVATAR_SIZES[size],
        SECTOR_STYLES[sector],
        className,
      )}
    >
      {symbol.charAt(0)}
    </span>
  );
}
