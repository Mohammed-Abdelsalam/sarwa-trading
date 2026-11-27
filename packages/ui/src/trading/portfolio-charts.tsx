import { DIRECTION_ARROW, direction as toDirection } from '@sarwa/core';
import { type Sector } from '@sarwa/tokens';

import { cn } from '../lib/cn';

export type AllocationColor = Sector | 'cash' | 'brand' | 'info' | 'warn' | 'pos' | 'neg';

const SWATCH: Record<AllocationColor, string> = {
  tech: 'bg-sector-tech',
  fin: 'bg-sector-fin',
  energy: 'bg-sector-energy',
  health: 'bg-sector-health',
  consumer: 'bg-sector-consumer',
  media: 'bg-sector-media',
  cash: 'bg-fg-3',
  brand: 'bg-brand',
  info: 'bg-info',
  warn: 'bg-warn',
  pos: 'bg-pos',
  neg: 'bg-neg',
};

export interface AllocationSegment {
  key: string;
  label: string;
  value: string;
  weight: number;
  weightLabel?: string;
  colorRole: AllocationColor;
}

const percent = (weight: number) => `${(Math.min(1, Math.max(0, weight)) * 100).toFixed(1)}%`;

export function AllocationBar({
  segments,
  label,
  legend = true,
  className,
}: {
  segments: readonly AllocationSegment[];
  label: string;
  legend?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-sm">
        {segments.map((s) => (
          <span
            key={s.key}
            className={cn('h-full', SWATCH[s.colorRole])}
            style={{ width: percent(s.weight) }}
          />
        ))}
      </div>
      <ul aria-label={label} className={cn('flex flex-col gap-1.5', !legend && 'sr-only')}>
        {segments.map((s) => (
          <li key={s.key} className="type-sm flex items-center gap-2">
            <span
              aria-hidden
              className={cn('size-2.5 shrink-0 rounded-[3px]', SWATCH[s.colorRole])}
            />
            <span className="text-fg min-w-0 flex-1 truncate">{s.label}</span>
            <span className="text-fg-2 tabular-nums">{s.value}</span>
            <span className="text-fg w-12 text-end font-semibold tabular-nums">
              {s.weightLabel ?? percent(s.weight)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface HeatmapTile {
  key: string;
  label: string;
  change: number;
  changeLabel: string;
  weight: number;
}

const HEAT_LEVELS = {
  up: ['bg-pos-subtle', 'bg-pos/25', 'bg-pos/35', 'bg-pos/50'],
  down: ['bg-neg-subtle', 'bg-neg/25', 'bg-neg/35', 'bg-neg/50'],
  flat: ['bg-flat-subtle', 'bg-flat-subtle', 'bg-flat-subtle', 'bg-flat-subtle'],
} as const;

export function Heatmap({
  tiles,
  label,
  fullScale = 3.5,
  largeAt = 0.1,
  className,
}: {
  tiles: readonly HeatmapTile[];
  label: string;
  fullScale?: number;
  largeAt?: number;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      className={cn('grid grid-flow-dense auto-rows-[4rem] grid-cols-6 gap-1', className)}
    >
      {tiles.map((tile) => {
        const dir = toDirection(tile.change);
        const level = Math.min(3, Math.floor((Math.abs(tile.change) / fullScale) * 4));
        return (
          <li
            key={tile.key}
            className={cn(
              'text-fg flex min-w-0 flex-col justify-between rounded-md px-2.5 py-2',
              HEAT_LEVELS[dir][level],
              tile.weight >= largeAt && 'col-span-2 row-span-2',
            )}
          >
            <span className="type-sm truncate font-bold">{tile.label}</span>
            <span className="text-xs leading-none font-semibold tabular-nums">
              <span aria-hidden>{DIRECTION_ARROW[dir]} </span>
              {tile.changeLabel}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
