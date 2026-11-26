import { appNotices, liveStatus } from '../src/status';

const open = { status: 'open' } as const;
const paused = { state: 'paused', volatility: 1, since: 1 } as const;
const banner = { message: 'Earnings season', tone: 'info' } as const;

describe('liveStatus', () => {
  it('maps connection and market state to one status', () => {
    expect(liveStatus({ status: 'offline' }, null)).toBe('offline');
    expect(liveStatus({ status: 'connecting' }, null)).toBe('reconnecting');
    expect(liveStatus(open, paused)).toBe('paused');
    expect(liveStatus(open, null)).toBe('live');
  });
});

describe('appNotices', () => {
  it('shows nothing when live and there is no banner', () => {
    expect(appNotices({ connection: open, market: null, banner: null })).toEqual([]);
  });

  it('puts the connection problem before the remote banner and counts retries', () => {
    const notices = appNotices({
      connection: { status: 'reconnecting', attempt: 3 },
      market: null,
      banner,
    });
    expect(notices.map((n) => n.kind)).toEqual(['reconnecting', 'remote']);
    expect(notices[0]?.message).toContain('(try 3)');
    expect(notices[1]?.dismissible).toBe(true);
  });
});
