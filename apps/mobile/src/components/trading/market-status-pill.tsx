import { View } from 'react-native';

import { type MarketPill, type MarketState } from '@sarwa/core';

import { cx } from '../../lib/theme';
import { Text } from '../ui/text';

const TONE: Record<MarketState, [container: string, dot: string]> = {
  open: ['bg-pos-subtle', 'bg-pos'],
  pre: ['bg-info-subtle', 'bg-info'],
  post: ['bg-info-subtle', 'bg-info'],
  closed: ['bg-surface-3', 'border-2 border-fg-3'],
  halted: ['bg-warn-subtle', 'bg-warn'],
  reconnecting: ['bg-surface-3', 'bg-warn'],
};

// The dot's shape (solid vs ring) carries the state too, so it reads without colour.
export function MarketStatusPill({ pill, short = false }: { pill: MarketPill; short?: boolean }) {
  const [container, dot] = TONE[pill.state];
  const label = short ? pill.short : pill.label;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      className={cx('min-h-7 flex-row items-center gap-2 self-start rounded-full px-3', container)}
    >
      <View className={cx('h-2 w-2 rounded-full', dot)} />
      <Text variant="caption" weight={600} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
