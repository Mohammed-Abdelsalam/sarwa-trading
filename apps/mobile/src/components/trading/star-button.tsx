import * as Haptics from 'expo-haptics';
import { Star } from 'lucide-react-native';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@sarwa/tokens';

import { useColors } from '../../lib/theme';

export function StarButton({
  symbol,
  watched,
  onToggle,
  size = 44,
}: {
  symbol: string;
  watched: boolean;
  onToggle: () => void;
  size?: 36 | 44;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: watched }}
      accessibilityLabel={
        watched ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`
      }
      hitSlop={(44 - size) / 2}
      onPressIn={() => {
        scale.set(withTiming(0.86, { duration: motion.duration.fast }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 8, stiffness: 300 }));
      }}
      onPress={() => {
        if (!watched) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      className="items-center justify-center rounded-md"
      style={{ width: size, height: 44 }}
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
