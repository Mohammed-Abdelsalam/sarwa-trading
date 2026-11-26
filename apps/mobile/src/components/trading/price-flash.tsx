import { memo, useEffect, useRef } from 'react';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { formatPrice } from '@sarwa/core';
import { motion } from '@sarwa/tokens';

import { useColors } from '../../lib/theme';
import { Text } from '../ui/text';

const FLASH_EASING = Easing.bezier(...motion.easing.standard);

export const PriceFlash = memo(function PriceFlash({
  price,
  variant = 'num-md',
}: {
  price: number;
  variant?: 'display' | 'num-lg' | 'num-md';
}) {
  const colors = useColors();
  const reducedMotion = useReducedMotion();
  const previous = useRef(price);
  const progress = useSharedValue(0);
  const up = useSharedValue(1);

  useEffect(() => {
    if (price === previous.current) return;
    up.set(price > previous.current ? 1 : 0);
    previous.current = price;
    progress.set(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(0, { duration: motion.duration.flash, easing: FLASH_EASING }),
      ),
    );
  }, [price, progress, up]);

  // Runs on the UI thread: the flash never re-renders React.
  const flashStyle = useAnimatedStyle(() => {
    const flash = up.get() === 1 ? colors['flash-up'] : colors['flash-down'];
    if (reducedMotion) {
      return {
        borderBottomWidth: 2,
        borderBottomColor:
          progress.get() > 0.01 ? (up.get() === 1 ? colors.pos : colors.neg) : 'transparent',
      };
    }
    return { backgroundColor: interpolateColor(progress.get(), [0, 1], ['transparent', flash]) };
  });

  return (
    <Animated.View
      style={[{ borderRadius: 6, paddingHorizontal: 6, marginHorizontal: -6 }, flashStyle]}
    >
      <Text variant={variant}>{formatPrice(price)}</Text>
    </Animated.View>
  );
});
