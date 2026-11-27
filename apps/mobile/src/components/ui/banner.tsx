import { type LucideIcon, X } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { type BannerTone, type ColorRole } from '@sarwa/tokens';

import { useCopy } from '../../lib/i18n';
import { cx, useColors } from '../../lib/theme';
import { IconButton } from './icon-button';

const TONE: Record<BannerTone, [container: string, icon: ColorRole]> = {
  info: ['border-info/30 bg-info-subtle', 'info'],
  warn: ['border-warn/30 bg-warn-subtle', 'warn'],
  neutral: ['border-border bg-surface-3', 'fg-2'],
  brand: ['border-brand/35 bg-brand-subtle', 'brand-fg'],
};

export function Banner({
  tone,
  icon: Icon,
  busy = false,
  children,
  action,
  onDismiss,
}: {
  tone: BannerTone;
  icon?: LucideIcon;
  busy?: boolean;
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  const colors = useColors();
  const { t } = useCopy();
  const [container, iconColor] = TONE[tone];
  return (
    <View
      accessibilityRole="alert"
      className={cx(
        'flex-row items-center gap-2.5 rounded-control-lg border py-2.5 ps-3.5',
        onDismiss ? 'pe-1' : 'pe-3.5',
        container,
      )}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors[iconColor]} />
      ) : Icon ? (
        <Icon size={16} color={colors[iconColor]} />
      ) : null}
      <View className="flex-1">{children}</View>
      {action}
      {onDismiss ? (
        <IconButton
          label={t.common.dismiss}
          icon={X}
          iconSize={16}
          size={44}
          className="-my-2.5"
          onPress={onDismiss}
        />
      ) : null}
    </View>
  );
}
