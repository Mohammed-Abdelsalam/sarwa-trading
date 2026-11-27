import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '../../components/ui/text';
import { FieldError } from '../../components/ui/text-field';
import { cx } from '../../lib/theme';

const BLINK_MS = 500;

function Caret() {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!reducedMotion) opacity.set(withRepeat(withTiming(0, { duration: BLINK_MS }), -1, true));
  }, [opacity, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={style} className="ms-0.5 h-11 w-0.5 bg-brand" />;
}

export function AmountDisplay({
  prefix,
  value,
  suffix,
  empty,
  hint,
  focused,
  label,
  error,
  onPress,
}: {
  prefix: string;
  value: string;
  suffix: string;
  empty: boolean;
  hint: string;
  focused: boolean;
  label: string;
  error?: string;
  onPress: () => void;
}) {
  return (
    <View className="items-center gap-0.5 pb-0.5 pt-1.5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${prefix}${value}${suffix}`}
        accessibilityState={{ selected: focused }}
        onPress={onPress}
        className="min-h-[60px] flex-row items-center"
      >
        <Text variant="display" className="text-fg-3">
          {prefix}
        </Text>
        <Text variant="display" className={empty ? 'text-fg-3' : 'text-fg'}>
          {value}
        </Text>
        {focused ? <Caret /> : null}
        {suffix ? (
          <Text variant="num-lg" weight={500} className="text-fg-3">
            {suffix}
          </Text>
        ) : null}
      </Pressable>
      {hint ? (
        <Text variant="sm" className="text-fg-2" style={{ fontVariant: ['tabular-nums'] }}>
          {hint}
        </Text>
      ) : null}
      {error ? (
        <View className="w-full pt-1">
          <FieldError message={error} />
        </View>
      ) : null}
    </View>
  );
}

export function KeypadField({
  label,
  value,
  focused,
  error,
  hint,
  onPress,
}: {
  label: string;
  value: string;
  focused: boolean;
  error?: string | undefined;
  hint?: string | undefined;
  onPress: () => void;
}) {
  return (
    <View className="gap-1.5">
      <Text variant="sm" weight={600} className="text-fg-2">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityState={{ selected: focused }}
        accessibilityHint={error}
        onPress={onPress}
        className={cx(
          'min-h-12 flex-row items-center rounded-control-lg border bg-surface px-3.5',
          error ? 'border-neg' : focused ? 'border-brand' : 'border-border-strong',
        )}
      >
        <Text variant="num-lg" className="text-fg-3">
          $
        </Text>
        <Text variant="num-lg">{value}</Text>
        {focused ? <Caret /> : null}
      </Pressable>
      {error ? (
        <FieldError message={error} />
      ) : hint ? (
        <Text variant="caption" className="text-fg-3">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
