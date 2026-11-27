import { type LucideIcon, Megaphone, Pause, WifiOff } from 'lucide-react-native';
import { View } from 'react-native';

import { type NoticeKind, useAppNotices } from '@sarwa/core';

import { Banner } from '../ui/banner';
import { Text } from '../ui/text';

const NOTICE_ICONS: Record<NoticeKind, LucideIcon | undefined> = {
  offline: WifiOff,
  reconnecting: undefined,
  paused: Pause,
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
          busy={notice.kind === 'reconnecting'}
          action={
            notice.meta ? (
              <Text variant="caption" className="text-fg-3">
                {notice.meta}
              </Text>
            ) : undefined
          }
          onDismiss={
            notice.dismissible
              ? () => {
                  dismiss(notice);
                }
              : undefined
          }
        >
          <Text variant="sm" weight={500}>
            {notice.title ? <Text variant="sm" weight={700}>{`${notice.title} `}</Text> : null}
            {notice.message}
          </Text>
        </Banner>
      ))}
    </View>
  );
}
