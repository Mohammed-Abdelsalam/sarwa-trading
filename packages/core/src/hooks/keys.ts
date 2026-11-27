import { type Period } from '@sarwa/contracts';

export const queryKeys = {
  stocks: ['stocks'] as const,
  stock: (symbol: string) => ['stocks', symbol] as const,
  candles: (symbol: string, period: Period) => ['stocks', symbol, 'candles', period] as const,
  watchlist: ['watchlist'] as const,
  appConfig: ['app-config'] as const,
  preference: (key: string) => ['preference', key] as const,
};
