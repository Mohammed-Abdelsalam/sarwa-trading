import { type Banner, type MarketStatus } from '@sarwa/contracts';

import { type ConnectionState } from './store';

export type LiveStatus = 'live' | 'reconnecting' | 'offline' | 'paused';

export function liveStatus(connection: ConnectionState, market: MarketStatus | null): LiveStatus {
  if (connection.status === 'offline') return 'offline';
  if (connection.status !== 'open') return 'reconnecting';
  return market?.state === 'paused' ? 'paused' : 'live';
}

export type NoticeKind = 'offline' | 'reconnecting' | 'paused' | 'remote';

export interface AppNotice {
  kind: NoticeKind;
  tone: 'neutral' | 'warning' | 'info';
  message: string;
  dismissible: boolean;
}

const MAX_NOTICES = 2;

// Connection problems outrank the remote banner, and at most two notices show at once.
export function appNotices({
  connection,
  market,
  banner,
}: {
  connection: ConnectionState;
  market: MarketStatus | null;
  banner: Banner | null | undefined;
}): AppNotice[] {
  const notices: AppNotice[] = [];
  const status = liveStatus(connection, market);

  if (status === 'offline') {
    notices.push({
      kind: 'offline',
      tone: 'neutral',
      message: "You're offline — showing cached prices.",
      dismissible: false,
    });
  } else if (status === 'reconnecting') {
    const attempt = connection.status === 'reconnecting' ? connection.attempt : 0;
    notices.push({
      kind: 'reconnecting',
      tone: 'warning',
      message: `Reconnecting… Prices may be a few seconds behind.${attempt > 0 ? ` (try ${String(attempt)})` : ''}`,
      dismissible: false,
    });
  } else if (status === 'paused') {
    notices.push({
      kind: 'paused',
      tone: 'info',
      message: 'Market paused — prices are frozen and will resume automatically.',
      dismissible: false,
    });
  }

  if (banner) {
    notices.push({
      kind: 'remote',
      tone: banner.tone === 'warning' ? 'warning' : 'info',
      message: banner.message,
      dismissible: true,
    });
  }

  return notices.slice(0, MAX_NOTICES);
}
