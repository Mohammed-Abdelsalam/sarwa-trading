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
import { motion, type PriceSize } from '@sarwa/tokens';

import { useCopy } from '../../lib/i18n';
import { useColors } from '../../lib/theme';
import { Text, type TextVariant } from '../ui/text';

const FLASH_EASING = Easing.bezier(...motion.easing.standard);

const VARIANT: Record<PriceSize, TextVariant> = {
  display: 'display',
  'display-web': 'display-web',
  lg: 'num-lg',
  md: 'num-md',
  sm: 'num-sm',
};

export const PriceFlash = memo(function PriceFlash({
  price,
  size = 'md',
  format,
  muted = false,
}: {
  price: number;
  size?: PriceSize;
  format?: (price: number) => string;
  muted?: boolean;
}) {
  const { f } = useCopy();
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
        borderBottomWidth: motion.reduced.flashUnderlinePx,
        borderBottomColor:
          progress.get() > 0.01 ? (up.get() === 1 ? colors.pos : colors.neg) : 'transparent',
      };
    }
    return { backgroundColor: interpolateColor(progress.get(), [0, 1], ['transparent', flash]) };
  });

  return (
    <Animated.View className="-mx-1.5 rounded-sm px-1.5" style={flashStyle}>
      <Text variant={VARIANT[size]} className={muted ? 'text-fg-2' : undefined}>
        {format ? format(price) : formatPrice(f, price)}
      </Text>
    </Animated.View>
  );
});
