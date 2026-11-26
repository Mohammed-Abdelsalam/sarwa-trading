import { type LucideIcon, Megaphone, PauseCircle, RefreshCw, WifiOff } from 'lucide-react-native';
import { View } from 'react-native';

import { type NoticeKind, useAppNotices } from '@sarwa/core';

import { Banner } from '../ui/banner';
import { Text } from '../ui/text';

const NOTICE_ICONS: Record<NoticeKind, LucideIcon> = {
  offline: WifiOff,
  reconnecting: RefreshCw,
  paused: PauseCircle,
  remote: Megaphone,
};

export function AppBanners() {
  const { notices, dismiss } = useAppNotices();
  if (notices.length === 0) return null;

  return (
    <View className="gap-2 px-4 pb-3">
      {notices.map((notice) => (
        <Banner
          key={notice.kind}
          tone={notice.tone}
          icon={NOTICE_ICONS[notice.kind]}
          onDismiss={
            notice.dismissible
              ? () => {
                  dismiss(notice);
                }
              : undefined
          }
        >
          <Text variant="sm">{notice.message}</Text>
        </Banner>
      ))}
    </View>
  );
}
