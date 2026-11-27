import { router } from 'expo-router';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { View } from 'react-native';

import { type LiveStatus } from '@sarwa/core';

import { ConnectionBadge } from '../../components/trading/connection-badge';
import { StarButton } from '../../components/trading/star-button';
import { IconButton } from '../../components/ui/icon-button';

export function TopBar({
  symbol,
  status,
  watched,
  onToggleWatch,
  onShare,
}: {
  symbol: string;
  status: LiveStatus;
  watched: boolean;
  onToggleWatch: () => void;
  onShare: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between px-2 pb-1">
      <IconButton
        label="Back"
        icon={ChevronLeft}
        iconSize={24}
        size={44}
        onPress={() => {
          router.back();
        }}
      />
      <ConnectionBadge status={status} />
      <View className="flex-row items-center">
        <IconButton label="Share" icon={Share2} size={44} onPress={onShare} />
        <StarButton symbol={symbol} watched={watched} onToggle={onToggleWatch} />
      </View>
    </View>
  );
}
