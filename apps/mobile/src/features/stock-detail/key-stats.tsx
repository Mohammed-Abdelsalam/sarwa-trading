import { View } from 'react-native';

import { type KeyStat } from '@sarwa/core';

import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { cx } from '../../lib/theme';

export function KeyStats({ stats }: { stats: KeyStat[] }) {
  const { t } = useCopy();
  const lastRow = stats.length - 2;
  return (
    <View className="gap-3 px-5 pt-6">
      <View className="flex-row items-baseline justify-between">
        <Text variant="h3">{t.stock.keyStats}</Text>
        <Text variant="caption" className="text-fg-3">
          {t.stock.simulated}
        </Text>
      </View>
      <View className="flex-row flex-wrap overflow-hidden rounded-lg border border-border bg-surface">
        {stats.map(({ label, value }, i) => (
          <View
            key={label}
            className={cx(
              'w-1/2 gap-0.5 px-4 py-2.5',
              i % 2 === 0 && 'border-e border-border',
              i < lastRow && 'border-b border-border',
            )}
          >
            <Text variant="overline" className="text-fg-3">
              {label}
            </Text>
            <Text variant="num-md">{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
