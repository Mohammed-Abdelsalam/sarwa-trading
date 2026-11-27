import { type Banner, type MarketStatus } from '@sarwa/contracts';
import { type Messages } from '@sarwa/i18n';
import { type BannerTone } from '@sarwa/tokens';

import { type Localized } from './format';
import { type ConnectionState } from './store';

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline' | 'paused';

export function liveStatusLabel(t: Messages, status: LiveStatus): string {
  return t.market.states[status];
}

// Offline or paused means the prices on screen are no longer moving, so they render muted.
export function isStale(status: LiveStatus): boolean {
  return status === 'offline' || status === 'paused';
}

export function liveStatus(connection: ConnectionState, market: MarketStatus | null): LiveStatus {
  switch (connection.status) {
    case 'offline':
      return 'offline';
    case 'idle':
    case 'connecting':
      return 'connecting';
    case 'reconnecting':
      return 'reconnecting';
    case 'open':
      return market?.state === 'paused' ? 'paused' : 'live';
  }
}

export type NoticeKind = 'offline' | 'reconnecting' | 'paused' | 'remote';

export interface AppNotice {
  kind: NoticeKind;
  tone: BannerTone;
  title?: string;
  message: string;
  meta?: string;
  dismissible: boolean;
}

const MAX_NOTICES = 2;

// Connection problems outrank the remote banner, and at most two notices show at once.
export function appNotices(
  { t, f }: Localized,
  {
    connection,
    market,
    banner,
    cachedAt,
  }: {
    connection: ConnectionState;
    market: MarketStatus | null;
    banner: Banner | null | undefined;
    cachedAt?: number | undefined;
  },
): AppNotice[] {
  const notices: AppNotice[] = [];
  const status = liveStatus(connection, market);

  if (status === 'offline') {
    notices.push({
      kind: 'offline',
      tone: 'neutral',
      title: t.notices.offlineTitle,
      message: cachedAt ? t.notices.offlineSince({ time: f.time(cachedAt) }) : t.notices.offline,
      dismissible: false,
    });
  } else if (status === 'reconnecting') {
    const attempt = connection.status === 'reconnecting' ? connection.attempt : 0;
    notices.push({
      kind: 'reconnecting',
      tone: 'warn',
      title: t.market.states.reconnecting,
      message: t.notices.reconnecting,
      ...(attempt > 0 && { meta: t.notices.attempt(f.count(attempt)) }),
      dismissible: false,
    });
  } else if (status === 'paused' && market) {
    notices.push({
      kind: 'paused',
      tone: 'info',
      title: t.market.states.paused,
      message: t.notices.paused({ time: f.time(market.since) }),
      dismissible: false,
    });
  }

  // Admin "info" messages render as the brand banner, as in the canvas (M-Global, A-Config preview).
  if (banner) {
    notices.push({
      kind: 'remote',
      tone: banner.tone === 'warning' ? 'warn' : 'brand',
      message: banner.message,
      dismissible: true,
    });
  }

  return notices.slice(0, MAX_NOTICES);
}
