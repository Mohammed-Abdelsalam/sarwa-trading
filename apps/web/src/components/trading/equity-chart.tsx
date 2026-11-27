import { useId } from 'react';

import { chartGeometry } from '@sarwa/core';
import { cn, Skeleton } from '@sarwa/ui';

const WIDTH = 800;

// The equity curve: a filled line in a stretched fixed-width viewBox, coloured by the period's direction.
export function EquityChart({
  values,
  height,
  label,
  loading = false,
  className,
}: {
  values: readonly number[];
  height: number;
  label?: string;
  loading?: boolean;
  className?: string;
}) {
  const gradientId = useId();
  if (loading)
    return <Skeleton className={cn('w-full rounded-md', className)} style={{ height }} />;
  const geometry = chartGeometry(values, WIDTH, height, 10);
  const rising = (values.at(-1) ?? 0) >= (values[0] ?? 0);
  const tone = rising ? 'pos' : 'neg';

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${String(WIDTH)} ${String(height)}`}
      preserveAspectRatio="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('block', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`var(--color-${tone})`} stopOpacity={0.22} />
          <stop offset="1" stopColor={`var(--color-${tone})`} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={geometry.area} fill={`url(#${gradientId})`} />
      <path
        d={geometry.line}
        fill="none"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        className={rising ? 'stroke-pos' : 'stroke-neg'}
      />
    </svg>
  );
}
