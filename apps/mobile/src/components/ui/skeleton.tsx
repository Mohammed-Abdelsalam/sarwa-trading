import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { cx, useColors } from '../../lib/theme';

const SHIMMER_MS = 1400;

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(progress);
      return;
    }
    progress.set(withRepeat(withTiming(1, { duration: SHIMMER_MS / 2 }), -1, true));
  }, [progress, reducedMotion]);
  // React Native has no CSS gradients, so the canvas shimmer becomes a skel-a ↔ skel-b pulse.
  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors['skel-a'], colors['skel-b']]),
  }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[animated, style]}
      className={cx('rounded-sm', className)}
    />
  );
}
