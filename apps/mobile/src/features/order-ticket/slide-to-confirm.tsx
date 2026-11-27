import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { shadows } from '@sarwa/tokens';

import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
import { cx, useColors, useThemeName } from '../../lib/theme';

const KNOB = 48;
const INSET = 4;
const CONFIRM_AT = 0.9;

export interface ConfirmModel {
  slideLabel: string;
  buttonLabel: string;
  caption: string;
  plain: boolean;
  sending: boolean;
  disabled: boolean;
}

// Never optimistic: once released at the end it shows "Sending…" until the server answers.
export function SlideToConfirm({
  confirm,
  sendingLabel,
  onConfirm,
}: {
  confirm: ConfirmModel;
  sendingLabel: string;
  onConfirm: () => void;
}) {
  const colors = useColors();
  const { dir } = useCopy();
  const shadow = shadows[useThemeName()].e2;
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(0);
  const sign = dir === 'rtl' ? -1 : 1;
  const travel = Math.max(0, width - KNOB - INSET * 2);
  const reducedMotion = useReducedMotion();
  const locked = confirm.disabled || confirm.sending;

  useEffect(() => {
    if (!confirm.sending) offset.set(reducedMotion ? 0 : withSpring(0));
  }, [confirm.sending, offset, reducedMotion]);

  const gesture = usePanGesture({
    enabled: !locked,
    onUpdate: (event) => {
      offset.set(Math.min(travel, Math.max(0, event.translationX * sign)));
    },
    onDeactivate: () => {
      if (travel > 0 && offset.get() >= travel * CONFIRM_AT) {
        offset.set(travel);
        scheduleOnRN(onConfirm);
      } else {
        offset.set(reducedMotion ? 0 : withSpring(0));
      }
    },
  });

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() * sign }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: offset.get() + KNOB + INSET }));

  if (confirm.plain) {
    return (
      <Button size="lg" disabled={locked} loading={confirm.sending} onPress={onConfirm}>
        {confirm.sending ? sendingLabel : confirm.buttonLabel}
      </Button>
    );
  }

  return (
    <View className="gap-2.5">
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={confirm.buttonLabel}
          accessibilityState={{ disabled: locked, busy: confirm.sending }}
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={() => {
            if (!locked) onConfirm();
          }}
          onLayout={(event) => {
            setWidth(event.nativeEvent.layout.width);
          }}
          className={cx(
            'h-14 items-center justify-center overflow-hidden rounded-full bg-brand-subtle',
            locked && !confirm.sending && 'opacity-40',
          )}
        >
          <Animated.View
            style={fillStyle}
            className="absolute bottom-0 start-0 top-0 rounded-full bg-brand opacity-20"
          />
          <Text variant="button-lg" className="text-brand-fg">
            {confirm.sending ? sendingLabel : confirm.slideLabel}
          </Text>
          <Animated.View
            style={[knobStyle, { boxShadow: shadow }]}
            className="absolute start-1 top-1 h-12 w-12 items-center justify-center rounded-full bg-brand"
          >
            <ChevronRight
              size={22}
              color={colors['on-brand']}
              style={dir === 'rtl' ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          </Animated.View>
        </View>
      </GestureDetector>
      <Text variant="caption" className="text-center text-fg-3">
        {confirm.caption}
      </Text>
    </View>
  );
}
