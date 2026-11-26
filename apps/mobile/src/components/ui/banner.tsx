import { type LucideIcon, X } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { cx, useColors } from '../../lib/theme';

const BANNER_TONES = {
  info: ['border-info/30 bg-info-subtle', 'info'],
  warning: ['border-warn/30 bg-warn-subtle', 'warn'],
  neutral: ['border-border bg-surface-3', 'fg-2'],
} as const;

export function Banner({
  tone,
  icon: Icon,
  children,
  onDismiss,
}: {
  tone: keyof typeof BANNER_TONES;
  icon: LucideIcon;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const colors = useColors();
  const [container, iconColor] = BANNER_TONES[tone];
  return (
    <View
      accessibilityRole="alert"
      className={cx(
        'flex-row items-center gap-2.5 rounded-[12px] border py-2.5 pl-3.5 pr-2',
        container,
      )}
    >
      <Icon size={16} color={colors[iconColor]} />
      <View className="flex-1">{children}</View>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          onPress={onDismiss}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-[8px]"
        >
          <X size={16} color={colors['fg-2']} />
        </Pressable>
      ) : null}
    </View>
  );
}
