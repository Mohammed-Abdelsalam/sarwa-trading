import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { cx } from '../../lib/theme';

export function Skeleton({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!reducedMotion) opacity.set(withRepeat(withTiming(0.45, { duration: 700 }), -1, true));
  }, [opacity, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={style} className={cx('rounded-sm bg-surface-3', className)} />;
}
