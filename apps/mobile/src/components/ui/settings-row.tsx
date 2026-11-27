import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useCopy } from '../../lib/i18n';
import { cx, useColors } from '../../lib/theme';
import { Text } from './text';

export function SettingsCard({ children }: { children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-lg border border-border bg-surface">{children}</View>
  );
}

// One row of a settings card: icon · title (and optional sub) · value · chevron when it navigates.
export function SettingsRow({
  icon: Icon,
  title,
  sub,
  value,
  trailing,
  onPress,
  danger = false,
  chevron = onPress !== undefined && trailing === undefined,
  accessibilityLabel,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const { dir } = useCopy();
  const label = accessibilityLabel ?? [title, sub, value].filter(Boolean).join(', ');
  const content = (
    <>
      <View className="h-9 w-9 items-center justify-center rounded-control-lg bg-surface-3">
        <Icon size={18} color={danger ? colors.neg : colors['fg-2']} />
      </View>
      <View className="min-w-0 flex-1">
        <Text variant="sm" weight={600} className={danger ? 'text-neg' : 'text-fg'}>
          {title}
        </Text>
        {sub ? (
          <Text variant="caption" className="text-fg-3">
            {sub}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="sm" numberOfLines={1} className="shrink text-fg-2">
          {value}
        </Text>
      ) : null}
      {trailing}
      {chevron ? (
        <ChevronRight
          size={16}
          color={colors['fg-3']}
          style={dir === 'rtl' ? { transform: [{ scaleX: -1 }] } : undefined}
        />
      ) : null}
    </>
  );
  const className = 'min-h-14 flex-row items-center gap-3 border-b border-border px-3.5 py-2.5';
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={cx(className, 'active:bg-surface-3')}
    >
      {content}
    </Pressable>
  ) : (
    <View className={className}>{content}</View>
  );
}
