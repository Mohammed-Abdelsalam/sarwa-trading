import { createStore } from 'zustand/vanilla';

import { type AppConfig, type MarketStatus, type Quote } from '@sarwa/contracts';

export type ConnectionState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'open' }
  | { status: 'reconnecting'; attempt: number }
  | { status: 'offline' };

export interface LiveState {
  quotes: Record<string, Quote>;
  connection: ConnectionState;
  marketStatus: MarketStatus | null;
  appConfig: AppConfig | null;
  applyQuotes(quotes: Quote[]): void;
  setConnection(connection: ConnectionState): void;
  setMarketStatus(status: MarketStatus): void;
  setAppConfig(config: AppConfig): void;
}

export type LiveStore = ReturnType<typeof createLiveStore>;

export function isNewer(next: Quote, current: Quote | undefined): boolean {
  if (!current) return true;
  return next.ts > current.ts || (next.ts === current.ts && next.seq > current.seq);
}

export function createLiveStore() {
  return createStore<LiveState>()((set, get) => ({
    quotes: {},
    connection: { status: 'idle' },
    marketStatus: null,
    appConfig: null,

    applyQuotes: (incoming) => {
      const current = get().quotes;
      let next: Record<string, Quote> | null = null;
      for (const quote of incoming) {
        if (!isNewer(quote, (next ?? current)[quote.symbol])) continue;
        next ??= { ...current };
        next[quote.symbol] = quote;
      }
      // One store update per batch, and none at all when nothing is newer.
      if (next) set({ quotes: next });
    },

    setConnection: (connection) => {
      set({ connection });
    },
    setMarketStatus: (marketStatus) => {
      set({ marketStatus });
    },
    setAppConfig: (appConfig) => {
      const current = get().appConfig;
      if (!current || appConfig.updatedAt >= current.updatedAt) set({ appConfig });
    },
  }));
}
