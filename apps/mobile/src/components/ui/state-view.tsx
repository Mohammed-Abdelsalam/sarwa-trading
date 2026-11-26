import { type LucideIcon } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { View } from 'react-native';

import { cx, useColors } from '../../lib/theme';
import { Text } from './text';

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
  tone?: 'neutral' | 'neg' | 'brand';
  footnote?: string;
}) {
  const colors = useColors();
  const palette = {
    neutral: ['bg-surface-3', colors['fg-2']],
    neg: ['bg-neg-subtle', colors.neg],
    brand: ['bg-brand-subtle', colors['brand-fg']],
  } as const;
  const [bg, fg] = palette[tone];
  return (
    <View
      accessibilityRole={tone === 'neg' ? 'alert' : undefined}
      className="items-center gap-3 px-6 py-8"
    >
      <View className={cx('h-[72px] w-[72px] items-center justify-center rounded-[22px]', bg)}>
        <Icon size={32} color={fg} />
      </View>
      <Text variant="h3" className="text-center">
        {title}
      </Text>
      {description ? (
        <Text variant="sm" className="max-w-[300px] text-center text-fg-2">
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
