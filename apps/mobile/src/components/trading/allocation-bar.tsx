import { View } from 'react-native';

import { cx } from '../../lib/theme';
import { Text } from '../ui/text';

export interface AllocationItem {
  key: string;
  label: string;
  share: number;
  pct: string;
}

const SWATCH: Record<string, string> = {
  tech: 'bg-sector-tech',
  fin: 'bg-sector-fin',
  energy: 'bg-sector-energy',
  health: 'bg-sector-health',
  consumer: 'bg-sector-consumer',
  media: 'bg-sector-media',
  cash: 'bg-fg-3',
};

const swatch = (key: string) => SWATCH[key] ?? 'bg-flat';

export function AllocationBar({
  items,
  label,
  legendCount = 4,
}: {
  items: readonly AllocationItem[];
  label: string;
  legendCount?: number;
}) {
  return (
    <View className="gap-2">
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${label}: ${items.map((i) => `${i.label} ${i.pct}`).join(', ')}`}
        className="h-3 flex-row gap-0.5 overflow-hidden rounded-[6px]"
      >
        {items.map((item) => (
          <View
            key={item.key}
            className={cx('h-full', swatch(item.key))}
            style={{ flexGrow: item.share, flexBasis: 0 }}
          />
        ))}
      </View>
      <View
        className="flex-row flex-wrap gap-y-1.5"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {items.slice(0, legendCount).map((item) => (
          <View key={item.key} className="w-1/2 flex-row items-center gap-2 pe-4">
            <View className={cx('h-2.5 w-2.5 rounded-[3px]', swatch(item.key))} />
            <Text variant="sm" className="flex-1" numberOfLines={1}>
              {item.label}
            </Text>
            <Text variant="sm" weight={700} style={{ fontVariant: ['tabular-nums'] }}>
              {item.pct}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
