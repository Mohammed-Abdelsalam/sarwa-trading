import { View } from 'react-native';

import { cx } from '../../lib/theme';

const FILL = { brand: 'bg-brand', warn: 'bg-warn', pos: 'bg-pos' } as const;

export function ProgressBar({
  fraction,
  label,
  tone = 'brand',
  thin = false,
}: {
  fraction: number;
  label: string;
  tone?: keyof typeof FILL;
  thin?: boolean;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      className={cx('overflow-hidden rounded-full bg-surface-3', thin ? 'h-1' : 'h-2')}
    >
      <View
        className={cx('h-full rounded-full', FILL[tone])}
        style={{ width: `${String(percent)}%` }}
      />
    </View>
  );
}
