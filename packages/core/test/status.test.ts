import { appNotices, LIVE_STATUS_LABELS, liveStatus } from '../src/status';

const open = { status: 'open' } as const;
const paused = { state: 'paused', volatility: 1, since: Date.UTC(2026, 10, 26, 19, 41) } as const;
const banner = { message: 'Earnings season', tone: 'info' } as const;

describe('liveStatus', () => {
  it('maps connection and market state to one status', () => {
    expect(liveStatus({ status: 'offline' }, null)).toBe('offline');
    expect(liveStatus({ status: 'reconnecting', attempt: 1 }, null)).toBe('reconnecting');
    expect(liveStatus(open, paused)).toBe('paused');
    expect(liveStatus(open, null)).toBe('live');
  });

  it('says connecting, not reconnecting, before the first connection', () => {
    expect(liveStatus({ status: 'idle' }, null)).toBe('connecting');
    expect(liveStatus({ status: 'connecting' }, null)).toBe('connecting');
    expect(LIVE_STATUS_LABELS.connecting).toBe('Connecting…');
  });
});

describe('appNotices', () => {
  it('shows nothing when live, or while connecting for the first time', () => {
    expect(appNotices({ connection: open, market: null, banner: null })).toEqual([]);
    expect(
      appNotices({ connection: { status: 'connecting' }, market: null, banner: null }),
    ).toEqual([]);
  });

  it('puts the connection problem before the remote banner and counts retries', () => {
    const notices = appNotices({
      connection: { status: 'reconnecting', attempt: 3 },
      market: null,
      banner,
    });

    expect(notices.map((n) => n.kind)).toEqual(['reconnecting', 'remote']);
    expect(notices[0]).toMatchObject({ tone: 'warn', title: 'Reconnecting…', meta: 'try 3' });
    expect(notices[1]).toMatchObject({ tone: 'brand', dismissible: true });
  });

  it('says when the cached prices are from while offline', () => {
    const [notice] = appNotices({
      connection: { status: 'offline' },
      market: null,
      banner: null,
      cachedAt: Date.UTC(2026, 10, 26, 15, 41),
    });

    expect(notice).toMatchObject({ kind: 'offline', tone: 'neutral', title: "You're offline" });
    expect(notice?.message).toMatch(/^— showing cached prices from \d{1,2}:\d{2} [AP]M\.$/);
  });

  it('gives the market time a pause started at', () => {
    const [notice] = appNotices({ connection: open, market: paused, banner: null });

    expect(notice?.message).toBe(
      '— prices are frozen at 2:41 PM ET and will resume automatically.',
    );
  });

  it('shows an admin warning banner in the warn tone', () => {
    const [notice] = appNotices({
      connection: open,
      market: null,
      banner: { message: 'Data delayed', tone: 'warning' },
    });

    expect(notice?.tone).toBe('warn');
  });
});
