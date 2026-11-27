import { type LucideIcon, Megaphone, Pause, WifiOff } from 'lucide-react';

import { type NoticeKind, useAppNotices } from '@sarwa/core';
import { Banner, Spinner } from '@sarwa/ui';

const ICONS: Record<Exclude<NoticeKind, 'reconnecting'>, LucideIcon> = {
  offline: WifiOff,
  paused: Pause,
  remote: Megaphone,
};

// Full-width bars under the nav (W-Global): connection notices outrank remote messages, max two.
export function AppBanners() {
  const { notices, dismiss } = useAppNotices();
  if (notices.length === 0) return null;

  return (
    <div>
      {notices.map((notice) => {
        const Icon = notice.kind === 'reconnecting' ? null : ICONS[notice.kind];
        return (
          <Banner
            key={notice.kind}
            bar
            tone={notice.tone}
            icon={Icon ? <Icon aria-hidden /> : <Spinner className="text-warn" />}
            action={
              notice.meta ? (
                <span className="type-caption text-fg-3">{notice.meta}</span>
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
            {notice.title ? <b className="font-semibold">{notice.title}</b> : null} {notice.message}
          </Banner>
        );
      })}
    </div>
  );
}
