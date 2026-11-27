import { View } from 'react-native';

import { cx } from '../../lib/theme';
import { Text } from './text';

export function KeyValueRow({
  label,
  value,
  valueClassName,
  total = false,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  total?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className={cx(
        'min-h-9 flex-row items-center justify-between gap-3',
        total ? 'mt-1 border-t border-border pt-2' : 'py-1.5',
      )}
    >
      <Text className={total ? 'text-fg' : 'text-fg-2'} weight={total ? 600 : 400}>
        {label}
      </Text>
      <Text
        weight={600}
        className={cx('shrink', valueClassName)}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  );
}
