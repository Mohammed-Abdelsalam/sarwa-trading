import { type Banner, type MarketStatus } from '@sarwa/contracts';
import { type BannerTone } from '@sarwa/tokens';

import { formatClock, formatMarketTime } from './format';
import { type ConnectionState } from './store';

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline' | 'paused';

export const LIVE_STATUS_LABELS: Record<LiveStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
  paused: 'Market paused',
};

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
export function appNotices({
  connection,
  market,
  banner,
  cachedAt,
}: {
  connection: ConnectionState;
  market: MarketStatus | null;
  banner: Banner | null | undefined;
  cachedAt?: number | undefined;
}): AppNotice[] {
  const notices: AppNotice[] = [];
  const status = liveStatus(connection, market);

  if (status === 'offline') {
    notices.push({
      kind: 'offline',
      tone: 'neutral',
      title: "You're offline",
      message: cachedAt
        ? `— showing cached prices from ${formatClock(cachedAt)}.`
        : '— showing cached prices.',
      dismissible: false,
    });
  } else if (status === 'reconnecting') {
    const attempt = connection.status === 'reconnecting' ? connection.attempt : 0;
    notices.push({
      kind: 'reconnecting',
      tone: 'warn',
      title: 'Reconnecting…',
      message: 'Prices may be a few seconds behind.',
      ...(attempt > 0 && { meta: `try ${String(attempt)}` }),
      dismissible: false,
    });
  } else if (status === 'paused' && market) {
    notices.push({
      kind: 'paused',
      tone: 'info',
      title: 'Market paused',
      message: `— prices are frozen at ${formatMarketTime(market.since)} and will resume automatically.`,
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
