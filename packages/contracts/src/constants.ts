/** Shared constants — changing one here changes server and every client together. */

export const API_PREFIX = 'api/v1';

/** Socket.IO namespace for the public market stream. */
export const MARKET_NAMESPACE = '/market';

/** Max symbols one socket may be subscribed to (protects the server from fan-out abuse). */
export const MAX_SUBSCRIBE_SYMBOLS = 50;

/** Simulator step: every TICK_MS each enabled symbol may move. */
export const TICK_MS = 500;

/** Server flush interval: changed quotes are batched per socket and sent at most this often. */
export const QUOTE_BATCH_MS = 250;

/** Header carrying the anonymous device id (watchlist ownership, no end-user auth). */
export const DEVICE_ID_HEADER = 'x-device-id';

/** Cookie holding the admin session JWT (httpOnly). */
export const ADMIN_SESSION_COOKIE = 'sarwa_admin_session';

export const PERIODS = ['1D', '1W', '1M', '1Y', 'ALL'] as const;

export const SECTORS = ['tech', 'fin', 'energy', 'health', 'consumer', 'media'] as const;

/** Human labels used by sector chips and tables (design system copy). */
export const SECTOR_LABELS = {
  tech: 'Tech',
  fin: 'Finance',
  energy: 'Energy',
  health: 'Healthcare',
  consumer: 'Consumer',
  media: 'Media',
} as const satisfies Record<(typeof SECTORS)[number], string>;

export const EXCHANGES = ['NASDAQ', 'NYSE'] as const;

/** Market-wide volatility multiplier range (admin › market slider: 0.5× calm … 3× wild). */
export const MARKET_VOLATILITY = { min: 0.5, max: 3, default: 1 } as const;

/** Per-stock volatility range (admin › stocks dialog). */
export const STOCK_VOLATILITY = { min: 0.1, max: 5 } as const;

/** Banner message limit (admin › config: "{n} / 90"). */
export const BANNER_MAX_LENGTH = 90;
