import { chartGeometry, type Direction } from '@sarwa/core/pure';

import { cn } from '../lib/cn';

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
        d={chartGeometry(values, width, height).line}
        className={cn('fill-none', SPARK_STROKE[direction])}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
