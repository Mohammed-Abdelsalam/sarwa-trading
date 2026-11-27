import { Check, Clock, X } from 'lucide-react-native';
import { View } from 'react-native';

import { type OrderTimelineStep as TimelineStep } from '@sarwa/core';
import { type ColorRole } from '@sarwa/tokens';

import { Text } from '../../components/ui/text';
import { cx, useColors } from '../../lib/theme';

const DOT: Record<TimelineStep['state'], [bg: string, icon: ColorRole]> = {
  done: ['bg-pos-subtle', 'pos'],
  now: ['bg-warn-subtle', 'warn'],
  failed: ['bg-neg-subtle', 'neg'],
};

const ICON = { done: Check, now: Clock, failed: X };

export function Timeline({ steps }: { steps: readonly TimelineStep[] }) {
  const colors = useColors();
  return (
    <View accessibilityRole="list">
      {steps.map((step, i) => {
        const [bg, icon] = DOT[step.state];
        const Icon = ICON[step.state];
        const last = i === steps.length - 1;
        return (
          <View
            key={step.key}
            accessible
            accessibilityLabel={[step.title, step.detail].filter(Boolean).join(', ')}
            className={cx('flex-row gap-3', !last && 'pb-[18px]')}
          >
            {last ? null : (
              <View className="absolute bottom-0 start-[11px] top-[22px] w-0.5 bg-border" />
            )}
            <View className={cx('h-6 w-6 items-center justify-center rounded-full', bg)}>
              <Icon size={14} color={colors[icon]} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="sm" weight={700}>
                {step.title}
              </Text>
              {step.detail ? (
                <Text
                  variant="caption"
                  className="text-fg-3"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {step.detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
