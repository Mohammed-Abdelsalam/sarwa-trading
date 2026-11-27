import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { type AlertsResponse, type TradingStatus } from '@sarwa/contracts';

import { type AnalyticsProvider } from '../analytics';
import { type TradingEvent } from '../market-socket';
import { useSarwa } from '../provider';
import { type MeKeys, queryKeys } from './keys';
import { prependNotification } from './notifications';
import { applyOrderUpdate } from './order-cache';
import { usePrivateScope } from './session';

function updateStatus(queryClient: QueryClient, update: (status: TradingStatus) => TradingStatus) {
  queryClient.setQueryData<TradingStatus>(queryKeys.tradingStatus, (status) =>
    status ? update(status) : status,
  );
}

export function applyTradingEvent(
  queryClient: QueryClient,
  keys: MeKeys,
  event: TradingEvent,
  track: AnalyticsProvider['track'],
): void {
  switch (event.name) {
    case 'order.updated':
      applyOrderUpdate(queryClient, keys, event.payload.order, track);
      return;
    case 'notification':
      prependNotification(queryClient, keys, event.payload.notification);
      return;
    case 'alert.triggered': {
      const { alert } = event.payload;
      queryClient.setQueryData<AlertsResponse>(keys.alerts, (current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) => (item.id === alert.id ? alert : item)),
            }
          : current,
      );
      // A once-alert disarms when it fires; only the server knows the new active count.
      void queryClient.invalidateQueries({ queryKey: keys.alerts });
      return;
    }
    case 'symbol.halted': {
      const { halt } = event.payload;
      updateStatus(queryClient, (status) => ({
        ...status,
        halts: [...status.halts.filter((h) => h.symbol !== halt.symbol), halt],
      }));
      return;
    }
    case 'symbol.resumed': {
      const { symbol } = event.payload;
      updateStatus(queryClient, (status) => ({
        ...status,
        halts: status.halts.filter((h) => h.symbol !== symbol),
      }));
      return;
    }
    case 'trading.status': {
      const next = event.payload.status;
      queryClient.setQueryData<TradingStatus>(queryKeys.tradingStatus, (current) =>
        current && current.updatedAt > next.updatedAt ? current : next,
      );
      return;
    }
    case 'account.reset':
      resync(queryClient, keys);
      return;
    // The session hooks sign this client out; the cache follows the identity change.
    case 'session.revoked':
      return;
  }
}

// Everything personal plus the trading status, which events also patch.
export function resync(queryClient: QueryClient, keys: MeKeys): void {
  for (const queryKey of [keys.root, queryKeys.tradingStatus]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

// Mount once per app, next to useMarketConnection: private socket events keep the caches current.
export function useTradingEvents(): void {
  const { market, analytics, store } = useSarwa();
  const queryClient = useQueryClient();
  const { keys } = usePrivateScope();

  useEffect(
    () =>
      market.onTradingEvent((event) => {
        applyTradingEvent(queryClient, keys, event, analytics.track);
      }),
    [market, queryClient, analytics, keys],
  );

  // Events sent while the socket was down are lost, so every reopen after the first refetches.
  useEffect(() => {
    let wasOpen = store.getState().connection.status === 'open';
    let openedBefore = wasOpen;
    return store.subscribe(({ connection }) => {
      const open = connection.status === 'open';
      if (open && !wasOpen && openedBefore) resync(queryClient, keys);
      if (open) openedBefore = true;
      wasOpen = open;
    });
  }, [store, queryClient, keys]);
}
