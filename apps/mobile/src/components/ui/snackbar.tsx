import { X } from 'lucide-react-native';
import { Pressable } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';

import { shadows } from '@sarwa/tokens';

import { useCopy } from '../../lib/i18n';
import { useThemeName } from '../../lib/theme';
import { IconButton } from './icon-button';
import { Text } from './text';

// Sits at the bottom of its screen container, so on a tab screen it stays above the tab bar.
export function Snackbar({
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { t } = useCopy();
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown}
      exiting={reducedMotion ? undefined : FadeOutDown}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="absolute inset-x-4 bottom-4 flex-row items-center gap-1 rounded-lg border border-border bg-surface-2 py-1 pe-1 ps-4"
      style={{ boxShadow: shadows[useThemeName()].e2 }}
    >
      <Text variant="sm" weight={600} className="flex-1">
        {message}
      </Text>
      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          className="h-11 justify-center rounded-control-sm px-3 active:bg-surface-3"
        >
          <Text variant="sm" weight={600} className="text-brand-fg">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
      <IconButton label={t.common.dismiss} icon={X} iconSize={16} size={44} onPress={onDismiss} />
    </Animated.View>
  );
}
