import { ChartArea, ChartCandlestick } from 'lucide-react';
import { type ReactNode } from 'react';

import { type Period } from '@sarwa/contracts';
import { CHART_TYPES, type ChartType, formatChange, formatPct } from '@sarwa/core';
import { ChangePill, PeriodTabs, SegmentedControl } from '@sarwa/ui';

const ICONS: Record<ChartType, ReactNode> = {
  area: <ChartArea aria-hidden />,
  candle: <ChartCandlestick aria-hidden />,
};
const TYPE_OPTIONS = CHART_TYPES.map((option) => ({ ...option, icon: ICONS[option.value] }));

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
          options={TYPE_OPTIONS}
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
