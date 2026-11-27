import { ChartArea, ChartCandlestick } from 'lucide-react';
import { type ReactNode } from 'react';

import { type Period } from '@sarwa/contracts';
import { CHART_TYPES, type ChartType, formatChange, formatPct, useI18n } from '@sarwa/core';
import { ChangePill, PeriodTabs, SegmentedControl } from '@sarwa/ui';

const ICONS: Record<ChartType, ReactNode> = {
  area: <ChartArea aria-hidden />,
  candle: <ChartCandlestick aria-hidden />,
};

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
  const { t, f } = useI18n();
  const typeOptions = CHART_TYPES.map((value) => ({
    value,
    label: t.chart.types[value],
    icon: ICONS[value],
  }));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <PeriodTabs
        value={period}
        onChange={onPeriodChange}
        enabled={enabledPeriods}
        label={t.chart.period}
      />
      {type && onTypeChange ? (
        <SegmentedControl
          label={t.chart.type}
          options={typeOptions}
          value={type}
          onChange={onTypeChange}
        />
      ) : change ? (
        <span className="type-sm">
          <ChangePill
            value={change.value}
            label={`${formatChange(f, change.value)} (${formatPct(f, change.pct)})`}
            variant="inline"
          />{' '}
          <span className="text-fg-3">{t.chart.thisPeriod}</span>
        </span>
      ) : null}
    </div>
  );
}
