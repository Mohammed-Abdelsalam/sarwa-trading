import { View } from 'react-native';

import { type Period } from '@sarwa/contracts';
import { type ChartType, formatChange, formatPct } from '@sarwa/core';

import { ChangePill } from '../../components/trading/change-pill';
import { ChartTypeToggle } from '../../components/trading/chart-type-toggle';
import { PeriodTabs } from '../../components/trading/period-tabs';
import { Text } from '../../components/ui/text';

export function ChartToolbar({
  period,
  enabledPeriods,
  onPeriodChange,
  type,
  onTypeChange,
  change,
}: {
  period: Period;
  enabledPeriods: readonly Period[];
  onPeriodChange: (period: Period) => void;
  type: ChartType;
  onTypeChange: (type: ChartType) => void;
  change: { value: number; pct: number } | null;
}) {
  return (
    <View className="gap-2.5 px-5 pb-3 pt-3.5">
      <View className="flex-row items-center gap-2.5">
        <View className="flex-1">
          <PeriodTabs value={period} onChange={onPeriodChange} enabled={enabledPeriods} />
        </View>
        <ChartTypeToggle value={type} onChange={onTypeChange} />
      </View>
      {change ? (
        <View className="flex-row items-center gap-1">
          <ChangePill
            value={change.value}
            label={`${formatChange(change.value)} (${formatPct(change.pct)})`}
            variant="inline"
          />
          <Text variant="sm" className="text-fg-3">
            this period
          </Text>
        </View>
      ) : null}
    </View>
  );
}
