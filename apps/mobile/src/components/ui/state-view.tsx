import { type LucideIcon } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { View } from 'react-native';

import { type ColorRole, type StateTone } from '@sarwa/tokens';

import { cx, useColors } from '../../lib/theme';
import { Text } from './text';

const TONE: Record<StateTone, [container: string, icon: ColorRole]> = {
  neutral: ['bg-surface-3', 'fg-2'],
  neg: ['bg-neg-subtle', 'neg'],
  brand: ['bg-brand-subtle', 'brand-fg'],
};

export function StateView({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
  footnote,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: StateTone;
  footnote?: string;
}) {
  const colors = useColors();
  const [container, iconColor] = TONE[tone];
  return (
    <View
      accessibilityRole={tone === 'neg' ? 'alert' : undefined}
      className="items-center gap-3 px-6 py-8"
    >
      <View className={cx('h-art w-art items-center justify-center rounded-art', container)}>
        <Icon size={32} color={colors[iconColor]} />
      </View>
      <Text variant="h3" className="text-center">
        {title}
      </Text>
      {description ? (
        <Text variant="sm" className="max-w-xs text-center text-fg-2">
          {description}
        </Text>
      ) : null}
      {action}
      {footnote ? (
        <Text variant="caption" className="text-fg-3">
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}
