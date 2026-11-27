import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { type LiveStatus, liveStatusLabel } from '@sarwa/core';
import { type ColorRole } from '@sarwa/tokens';

import { useCopy } from '../../lib/i18n';
import { cx, useColors } from '../../lib/theme';
import { Text } from '../ui/text';

const DOT_COLOR: Record<LiveStatus, ColorRole> = {
  connecting: 'warn',
  live: 'pos',
  reconnecting: 'warn',
  offline: 'fg-3',
  paused: 'info',
};

const PULSE_MS: Partial<Record<LiveStatus, number>> = {
  live: 1000,
  reconnecting: 500,
  connecting: 500,
};

// The dot's shape differs per state (pulse, blink, ring, pause bar) so status reads without colour.
export function ConnectionBadge({ status, label }: { status: LiveStatus; label?: string }) {
  const { t } = useCopy();
  const text = label ?? liveStatusLabel(t, status);
  const colors = useColors();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const color = colors[DOT_COLOR[status]];

  useEffect(() => {
    const duration = PULSE_MS[status];
    opacity.set(
      !reducedMotion && duration
        ? withRepeat(withTiming(0.3, { duration }), -1, true)
        : withTiming(1, { duration: 0 }),
    );
  }, [status, reducedMotion, opacity]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={text}
      className="h-7 flex-row items-center gap-conn-gap rounded-full border border-border bg-surface pe-2.5 ps-conn-start"
    >
      <Animated.View
        className={cx('h-2 w-2', status === 'paused' ? 'rounded-xs' : 'rounded-full')}
        style={[
          status === 'offline'
            ? { borderWidth: 2, borderColor: color }
            : { backgroundColor: color },
          dotStyle,
        ]}
      />
      <Text variant="caption" weight={600}>
        {text}
      </Text>
    </View>
  );
}
