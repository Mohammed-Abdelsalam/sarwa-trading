import { type ReactNode } from 'react';
import { View } from 'react-native';

import { useLiveStatus } from '@sarwa/core';

import { ConnectionBadge } from '../trading/connection-badge';
import { Text } from '../ui/text';

export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  const status = useLiveStatus();
  return (
    <View className="flex-row items-center justify-between px-5 pb-3 pt-1">
      <Text variant="h1" accessibilityRole="header">
        {title}
      </Text>
      {right ?? <ConnectionBadge status={status} />}
    </View>
  );
}
