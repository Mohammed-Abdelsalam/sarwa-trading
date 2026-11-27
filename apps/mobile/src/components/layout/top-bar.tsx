import { router } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { View } from 'react-native';

import { useCopy } from '../../lib/i18n';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';

// Stack screens: back (or close for modals) · centred title · optional trailing control.
export function TopBar({
  title,
  right,
  close = false,
  onLeave = () => {
    router.back();
  },
}: {
  title?: string;
  right?: ReactNode;
  close?: boolean;
  onLeave?: () => void;
}) {
  const { t, dir } = useCopy();
  return (
    <View className="min-h-12 flex-row items-center justify-between px-2">
      <IconButton
        label={close ? t.common.close : t.common.back}
        icon={close ? X : ChevronLeft}
        iconSize={close ? 20 : 24}
        size={44}
        flip={!close && dir === 'rtl'}
        onPress={onLeave}
      />
      {title ? (
        <Text variant="h3" accessibilityRole="header" numberOfLines={1} className="shrink px-2">
          {title}
        </Text>
      ) : null}
      <View className="min-w-11 flex-row items-center justify-end">{right}</View>
    </View>
  );
}
