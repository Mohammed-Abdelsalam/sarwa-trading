import * as Haptics from 'expo-haptics';
import { Star } from 'lucide-react-native';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { watchLabel } from '@sarwa/core';
import { layout, motion, type StarSize } from '@sarwa/tokens';

import { useCopy } from '../../lib/i18n';
import { cx, useColors } from '../../lib/theme';

export function StarButton({
  symbol,
  watched,
  onToggle,
  size = 44,
}: {
  symbol: string;
  watched: boolean;
  onToggle: () => void;
  size?: StarSize;
}) {
  const { t } = useCopy();
  const colors = useColors();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: watched }}
      accessibilityLabel={watchLabel(t, symbol, watched)}
      hitSlop={(layout.minTouchTarget - size) / 2}
      onPressIn={() => {
        if (!reducedMotion) scale.set(withTiming(0.86, { duration: motion.duration.fast }));
      }}
      onPressOut={() => {
        if (!reducedMotion) scale.set(withSpring(1, { damping: 8, stiffness: 300 }));
      }}
      onPress={() => {
        if (!watched) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      className={cx(
        'items-center justify-center',
        size === 44 ? 'h-11 w-11 rounded-control-lg' : 'h-11 w-9 rounded-md',
      )}
    >
      <Animated.View style={animated}>
        <Star
          size={20}
          color={watched ? colors.star : colors['fg-3']}
          fill={watched ? colors.star : 'transparent'}
        />
      </Animated.View>
    </Pressable>
  );
}
