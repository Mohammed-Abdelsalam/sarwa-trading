import { createContext, type ReactNode, useContext } from 'react';

import { type AnalyticsProvider } from './analytics';
import { type ApiClient } from './api';
import { type KeyValueStorage } from './device';
import { type MarketSocket } from './market-socket';
import { type LiveStore } from './store';
import { type RemovalQueue } from './undo';

export interface SarwaClient {
  api: ApiClient;
  market: MarketSocket;
  store: LiveStore;
  storage: KeyValueStorage;
  removals: RemovalQueue;
  analytics: AnalyticsProvider;
}

const SarwaContext = createContext<SarwaClient | null>(null);

export function SarwaProvider({ client, children }: { client: SarwaClient; children: ReactNode }) {
  return <SarwaContext value={client}>{children}</SarwaContext>;
}

export function useTrack(): AnalyticsProvider['track'] {
  return useSarwa().analytics.track;
}

export function useSarwa(): SarwaClient {
  const client = useContext(SarwaContext);
  if (!client) throw new Error('useSarwa must be used inside <SarwaProvider>');
  return client;
}
