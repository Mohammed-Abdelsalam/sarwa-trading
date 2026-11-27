import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { type AlertsResponse, type TradingStatus } from '@sarwa/contracts';

import { type AnalyticsProvider } from '../analytics';
import { type TradingEvent } from '../market-socket';
import { useSarwa } from '../provider';
import { queryKeys } from './keys';
import { prependNotification } from './notifications';
import { applyOrderUpdate } from './order-cache';

function updateStatus(queryClient: QueryClient, update: (status: TradingStatus) => TradingStatus) {
  queryClient.setQueryData<TradingStatus>(queryKeys.tradingStatus, (status) =>
    status ? update(status) : status,
  );
}

export function applyTradingEvent(
  queryClient: QueryClient,
  event: TradingEvent,
  track: AnalyticsProvider['track'],
): void {
  switch (event.name) {
    case 'order.updated':
      applyOrderUpdate(queryClient, event.payload.order, track);
      return;
    case 'notification':
      prependNotification(queryClient, event.payload.notification);
      return;
    case 'alert.triggered': {
      const { alert } = event.payload;
      queryClient.setQueryData<AlertsResponse>(queryKeys.alerts, (current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) => (item.id === alert.id ? alert : item)),
            }
          : current,
      );
      // A once-alert disarms when it fires; only the server knows the new active count.
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
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
  }
}

const RESYNC_KEYS = [
  queryKeys.allOrders,
  queryKeys.portfolio,
  queryKeys.account,
  queryKeys.notifications,
  queryKeys.alerts,
  queryKeys.tradingStatus,
];

// Mount once per app, next to useMarketConnection: private socket events keep the caches current.
export function useTradingEvents(): void {
  const { market, analytics, store } = useSarwa();
  const queryClient = useQueryClient();

  useEffect(
    () =>
      market.onTradingEvent((event) => {
        applyTradingEvent(queryClient, event, analytics.track);
      }),
    [market, queryClient, analytics],
  );

  // Events sent while the socket was down are lost, so every reopen after the first refetches.
  useEffect(() => {
    let wasOpen = store.getState().connection.status === 'open';
    let openedBefore = wasOpen;
    return store.subscribe(({ connection }) => {
      const open = connection.status === 'open';
      if (open && !wasOpen && openedBefore) {
        for (const queryKey of RESYNC_KEYS) void queryClient.invalidateQueries({ queryKey });
      }
      if (open) openedBefore = true;
      wasOpen = open;
    });
  }, [store, queryClient]);
}
