export const API_PREFIX = 'api/v1';

export const MARKET_NAMESPACE = '/market';

export const MAX_SUBSCRIBE_SYMBOLS = 50;

export const TICK_MS = 500;

export const QUOTE_BATCH_MS = 250;

export const DEVICE_ID_HEADER = 'x-device-id';

export const ADMIN_SESSION_COOKIE = 'sarwa_admin_session';

export const PERIODS = ['1D', '1W', '1M', '1Y', 'ALL'] as const;

export const SECTORS = ['tech', 'fin', 'energy', 'health', 'consumer', 'media'] as const;

export const EXCHANGES = ['NASDAQ', 'NYSE'] as const;

export const MARKET_VOLATILITY = { min: 0.5, max: 3, default: 1 } as const;

export const STOCK_VOLATILITY = { min: 0.1, max: 5 } as const;

export const BANNER_MAX_LENGTH = 90;
