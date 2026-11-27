import { ChartArea, ChartCandlestick } from 'lucide-react';

import { type Period } from '@sarwa/contracts';
import { formatChange, formatPct } from '@sarwa/core';
import { ChangePill, PeriodTabs, SegmentedControl } from '@sarwa/ui';

import { type ChartType } from './use-price-chart';

const CHART_TYPES = [
  { value: 'area', label: 'Area', icon: <ChartArea aria-hidden /> },
  { value: 'candle', label: 'Candlestick', icon: <ChartCandlestick aria-hidden /> },
] as const;

export function ChartToolbar({
  period,
  enabledPeriods,
  onPeriodChange,
  change,
  type,
  onTypeChange,
}: {
  period: Period;
  enabledPeriods: readonly Period[];
  onPeriodChange: (period: Period) => void;
  change: { value: number; pct: number } | null;
  type?: ChartType;
  onTypeChange?: (type: ChartType) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <PeriodTabs value={period} onChange={onPeriodChange} enabled={enabledPeriods} />
      {type && onTypeChange ? (
        <SegmentedControl
          label="Chart type"
          options={CHART_TYPES}
          value={type}
          onChange={onTypeChange}
        />
      ) : change ? (
        <span className="type-sm">
          <ChangePill
            value={change.value}
            label={`${formatChange(change.value)} (${formatPct(change.pct)})`}
            variant="inline"
          />{' '}
          <span className="text-fg-3">this period</span>
        </span>
      ) : null}
    </div>
  );
}
