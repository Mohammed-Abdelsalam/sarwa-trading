export const API_PREFIX = 'api/v1';

export const MARKET_NAMESPACE = '/market';

export const MAX_SUBSCRIBE_SYMBOLS = 50;

export const TICK_MS = 500;

export const QUOTE_BATCH_MS = 250;

export const DEVICE_ID_HEADER = 'x-device-id';

export const REQUEST_ID_HEADER = 'x-request-id';

export const ADMIN_SESSION_COOKIE = 'sarwa_admin_session';

export const PERIODS = ['1D', '1W', '1M', '1Y', 'ALL'] as const;

export const SECTORS = ['tech', 'fin', 'energy', 'health', 'consumer', 'media'] as const;

export const EXCHANGES = ['NASDAQ', 'NYSE'] as const;

export const MARKET_VOLATILITY = { min: 0.5, max: 3, default: 1 } as const;

export const STOCK_VOLATILITY = { min: 0.1, max: 5 } as const;

export const BANNER_MAX_LENGTH = 90;

// Customer auth on the web travels in cookies; mobile sends a bearer token and keeps the refresh
// token in SecureStore.
export const CUSTOMER_ACCESS_COOKIE = 'sarwa_access';
export const CUSTOMER_REFRESH_COOKIE = 'sarwa_refresh';
export const CUSTOMER_REFRESH_COOKIE_PATH = `/${API_PREFIX}/auth`;
// Double-submit: the readable cookie is echoed in the header on every cookie-authenticated mutation.
export const CSRF_COOKIE = 'sarwa_csrf';
export const CSRF_HEADER = 'x-csrf-token';
export const CLIENT_PLATFORM_HEADER = 'x-client-platform';
export const CLIENT_PLATFORMS = ['web', 'ios', 'android'] as const;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const AUTH_TTL_MS = {
  access: 15 * MINUTE_MS,
  refreshKeepSignedIn: 30 * DAY_MS,
  refresh: DAY_MS,
  passwordReset: 30 * MINUTE_MS,
  emailVerify: DAY_MS,
  adminInvite: 48 * HOUR_MS,
  guestTicket: 2 * MINUTE_MS,
  authIntent: 10 * MINUTE_MS,
  deletionGrace: 7 * DAY_MS,
} as const;

// Over the limit the server answers 429 RATE_LIMITED with Retry-After in seconds.
export const AUTH_LIMITS = {
  signInFailures: 5,
  signInWindowMs: 15 * MINUTE_MS,
  signInLockMs: 15 * MINUTE_MS,
  forgotPerHour: 3,
  signUpPerHour: 10,
  resendCooldownMs: MINUTE_MS,
} as const;

export const DELETE_CONFIRM = 'DELETE';
export const RESET_CONFIRM = 'RESET';

// Audit events are kept this long; their ip and user agent are anonymized sooner.
export const AUDIT_RETENTION_DAYS = 400;
export const AUDIT_PII_RETENTION_DAYS = 90;
