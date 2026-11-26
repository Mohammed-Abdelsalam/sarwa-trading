import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { type LiveStatus } from '@sarwa/core';

import { useColors } from '../../lib/theme';
import { Text } from '../ui/text';

const LIVE_LABEL: Record<LiveStatus, string> = {
  live: 'Live',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
  paused: 'Market paused',
};

export function ConnectionBadge({ status }: { status: LiveStatus }) {
  const colors = useColors();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const color = {
    live: colors.pos,
    reconnecting: colors.warn,
    offline: colors['fg-3'],
    paused: colors.info,
  }[status];

  useEffect(() => {
    const animate = !reducedMotion && (status === 'live' || status === 'reconnecting');
    opacity.set(
      animate
        ? withRepeat(withTiming(0.3, { duration: status === 'live' ? 1000 : 500 }), -1, true)
        : withTiming(1, { duration: 0 }),
    );
  }, [status, reducedMotion, opacity]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={LIVE_LABEL[status]}
      className="h-7 flex-row items-center gap-[7px] rounded-full border border-border bg-surface pl-[9px] pr-2.5"
    >
      <Animated.View
        style={[
          { width: 8, height: 8, borderRadius: status === 'paused' ? 1 : 4 },
          status === 'offline'
            ? { borderWidth: 2, borderColor: color }
            : { backgroundColor: color },
          dotStyle,
        ]}
      />
      <Text variant="caption" style={{ fontFamily: 'Inter_600SemiBold' }}>
        {LIVE_LABEL[status]}
      </Text>
    </View>
  );
}
