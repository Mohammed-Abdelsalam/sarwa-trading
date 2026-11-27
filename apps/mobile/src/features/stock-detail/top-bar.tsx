import { ChevronLeft, Share2 } from 'lucide-react-native';
import { View } from 'react-native';

import { type LiveStatus } from '@sarwa/core';

import { ConnectionBadge } from '../../components/trading/connection-badge';
import { StarButton } from '../../components/trading/star-button';
import { IconButton } from '../../components/ui/icon-button';
import { useCopy } from '../../lib/i18n';
import { goBack } from '../../lib/navigation';

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
  const { t, dir } = useCopy();
  return (
    <View className="flex-row items-center justify-between px-2 pb-1">
      <IconButton
        label={t.common.back}
        icon={ChevronLeft}
        iconSize={24}
        size={44}
        flip={dir === 'rtl'}
        onPress={goBack}
      />
      <ConnectionBadge status={status} />
      <View className="flex-row items-center">
        <IconButton label={t.common.share} icon={Share2} size={44} onPress={onShare} />
        <StarButton symbol={symbol} watched={watched} onToggle={onToggleWatch} />
      </View>
    </View>
  );
}
