import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Fragment, type ReactNode, useId } from 'react';

import { type Period } from '@sarwa/contracts';
import { type ChartType, formatPct, formatPrice, ohlc, useI18n } from '@sarwa/core';
import { layout } from '@sarwa/tokens';
import { Button, ChangePill, cn, Skeleton } from '@sarwa/ui';

import { usePriceChart } from './use-price-chart';

const GRID = [0.03, 0.5, 0.97];
const VOLUME_HEIGHT = layout.detail.volumeHeight;

export function PriceChart({
  symbol,
  period,
  type = 'area',
  height = 380,
  toolbar,
}: {
  symbol: string;
  period: Period;
  type?: ChartType;
  height?: number;
  toolbar?: (change: ReturnType<typeof usePriceChart>['periodChange']) => ReactNode;
}) {
  const i18n = useI18n();
  const { t, f } = i18n;
  const gradientId = useId();
  const chart = usePriceChart({ symbol, period, type, height });
  const tone = chart.rising ? 'pos' : 'neg';
  const cross = chart.crosshair;

  return (
    <div className="border-border bg-surface shadow-e1 min-w-0 rounded-lg border pt-4 pb-3 dark:shadow-none">
      {toolbar ? <div className="px-4 pb-3">{toolbar(chart.periodChange)}</div> : null}

      {chart.state === 'loading' ? (
        <div aria-label={t.chart.loading} className="flex flex-col gap-2.5 px-4" style={{ height }}>
          <Skeleton className="flex-1 rounded-md" />
          <Skeleton className="h-2.5" />
        </div>
      ) : chart.state === 'error' ? (
        <div
          role="alert"
          style={{ height }}
          className="border-border-strong mx-4 flex flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed text-center"
        >
          <span className="bg-neg-subtle text-neg grid size-11 place-items-center rounded-lg">
            <TriangleAlert aria-hidden className="size-5" />
          </span>
          <p className="type-h3">{t.chart.unavailable}</p>
          <p className="type-sm text-fg-2 max-w-60">{t.chart.unavailableBody({ period })}</p>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw aria-hidden className="size-4" />}
            onClick={chart.retry}
          >
            {t.common.retry}
          </Button>
        </div>
      ) : (
        // Time runs left to right in every locale, so the plot, axes and labels stay LTR together.
        <div dir="ltr">
          <div className="relative mr-18 max-md:mr-0" style={{ height }}>
            <div
              role="slider"
              tabIndex={0}
              aria-label={t.chart.label({ symbol })}
              aria-valuemin={0}
              aria-valuemax={chart.slider.max}
              aria-valuenow={chart.slider.now}
              aria-valuetext={chart.slider.text}
              className="focus-visible:outline-focus absolute inset-0 cursor-crosshair rounded-sm focus-visible:outline-2"
              {...chart.handlers}
            >
              <svg
                width="100%"
                height="100%"
                viewBox={chart.viewBox}
                preserveAspectRatio="none"
                aria-hidden
                className="block overflow-visible"
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={`var(--color-${tone})`} stopOpacity={0.24} />
                    <stop offset="1" stopColor={`var(--color-${tone})`} stopOpacity={0} />
                  </linearGradient>
                </defs>
                {GRID.map((f) => (
                  <line
                    key={f}
                    x1="0"
                    x2="800"
                    y1={height * f}
                    y2={height * f}
                    className="stroke-chart-grid"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {chart.baselineY === null ? null : (
                  <line
                    x1="0"
                    x2="800"
                    y1={chart.baselineY}
                    y2={chart.baselineY}
                    className="stroke-fg-3"
                    strokeDasharray="2 4"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {type === 'area' ? (
                  <>
                    <path d={chart.area.area} fill={`url(#${gradientId})`} />
                    <path
                      d={chart.area.line}
                      fill="none"
                      strokeWidth={2}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      className={tone === 'pos' ? 'stroke-pos' : 'stroke-neg'}
                    />
                  </>
                ) : (
                  chart.candles.map((c) => (
                    <g key={c.x} className={c.up ? 'fill-pos stroke-pos' : 'fill-neg stroke-neg'}>
                      <line
                        x1={c.x}
                        x2={c.x}
                        y1={c.wickTop}
                        y2={c.wickBottom}
                        vectorEffect="non-scaling-stroke"
                      />
                      <rect
                        x={c.x - c.width / 2}
                        y={c.bodyTop}
                        width={c.width}
                        height={c.bodyHeight}
                        rx={1}
                        strokeWidth={0}
                      />
                    </g>
                  ))
                )}
                {cross ? (
                  <g className="stroke-fg-2" strokeDasharray="4 4">
                    <line
                      x1={cross.xPct * 8}
                      x2={cross.xPct * 8}
                      y1="0"
                      y2={height}
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1="0"
                      x2="800"
                      y1={(cross.yPct / 100) * height}
                      y2={(cross.yPct / 100) * height}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                ) : null}
              </svg>
            </div>

            {cross ? (
              <>
                <span
                  aria-hidden
                  className={cn(
                    'border-surface pointer-events-none absolute -mt-1.5 -ml-1.5 size-3 rounded-full border-2',
                    tone === 'pos' ? 'bg-pos' : 'bg-neg',
                  )}
                  style={{ left: `${String(cross.xPct)}%`, top: `${String(cross.yPct)}%` }}
                />
                <div
                  aria-hidden
                  className="border-border bg-surface-2 shadow-e2 pointer-events-none absolute top-4 flex min-w-37.5 flex-col gap-0.5 rounded-lg border px-3 py-2.5"
                  style={
                    cross.xPct > 70
                      ? { right: `calc(${String(100 - cross.xPct)}% + 14px)` }
                      : { left: `calc(${String(cross.xPct)}% + 14px)` }
                  }
                >
                  <span className="type-caption text-fg-3">
                    {f.chartDate(cross.candle.t, period)}
                  </span>
                  <span className="type-num-lg">{formatPrice(f, cross.candle.c)}</span>
                  <ChangePill
                    value={cross.changePct}
                    label={formatPct(f, cross.changePct)}
                    variant="inline"
                  />
                  {type === 'candle' ? (
                    <dl className="type-num-sm mt-1 grid grid-cols-[auto_1fr] gap-x-3">
                      {ohlc(i18n, cross.candle).map(({ label, value }) => (
                        <Fragment key={label}>
                          <dt className="text-fg-3">{label}</dt>
                          <dd className="text-right">{value}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  ) : null}
                </div>
                <span
                  aria-hidden
                  className="bg-fg text-bg type-num-sm pointer-events-none absolute -right-17 -mt-2.75 rounded-sm px-1.5 py-0.5 max-md:hidden"
                  style={{ top: `${String(cross.yPct)}%` }}
                >
                  {formatPrice(f, cross.candle.c)}
                </span>
              </>
            ) : null}

            <div className="type-caption text-fg-3 absolute top-0 -right-16 bottom-0 flex flex-col justify-between tabular-nums max-md:hidden">
              {chart.ticks.map((tick) => (
                <span key={tick}>{formatPrice(f, tick)}</span>
              ))}
            </div>
          </div>

          <svg
            width="100%"
            height={VOLUME_HEIGHT}
            viewBox={`0 0 800 ${String(VOLUME_HEIGHT)}`}
            preserveAspectRatio="none"
            aria-hidden
            className="mt-2 block pr-18 max-md:pr-0"
          >
            {chart.candles.map((c) => (
              <rect
                key={c.x}
                x={c.x - c.width / 2}
                y={VOLUME_HEIGHT * (1 - c.volume)}
                width={c.width}
                height={VOLUME_HEIGHT * c.volume}
                className="fill-border-strong"
              />
            ))}
          </svg>
          <div className="type-caption text-fg-3 flex justify-between pt-1.5 pr-22 pl-4 tabular-nums max-md:pr-4">
            {chart.axisCandles.map((candle, i) => (
              <span key={candle?.t ?? i}>{candle ? f.chartTime(candle.t, period) : ''}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
