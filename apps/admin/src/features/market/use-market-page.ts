import { useState } from 'react';

import { MARKET_VOLATILITY } from '@sarwa/contracts';
import { useMarketStatus } from '@sarwa/core';
import {
  STATS_REFRESH_MS,
  useAdminSession,
  useAdminStats,
  useLiveTicker,
  useMarketCommand,
} from '@sarwa/core/admin';

import { shortActor } from '../overview/use-overview-page';

const TICKER = [
  'AAPL',
  'MSFT',
  'NVDA',
  'TSLA',
  'AMZN',
  'META',
  'JPM',
  'XOM',
  'NFLX',
  'AMD',
  'KO',
  'DIS',
];
export const DROP_WORD = 'DROP';
export const VOLATILITY_PRESETS = {
  calm: MARKET_VOLATILITY.min,
  normal: 1,
  wild: MARKET_VOLATILITY.max,
} as const;

export function useMarketPage() {
  const { canEdit } = useAdminSession();
  const stats = useAdminStats({ refetchInterval: STATS_REFRESH_MS });
  const live = useMarketStatus();
  const command = useMarketCommand();
  const ticker = useLiveTicker(TICKER);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropText, setDropText] = useState('');
  const [dropped, setDropped] = useState<number | null>(null);

  // The socket broadcasts every change; stats fill in until the first event arrives.
  const status = live ?? stats.data?.market ?? null;
  const paused = status?.state === 'paused';
  const lastChange = stats.data?.recentActivity.find(
    (entry) => entry.action.startsWith('market.') || entry.action === 'connections.drop',
  );

  const setVolatility = (volatility: number) => {
    command.mutate(
      { action: 'setVolatility', volatility: Math.round(volatility * 10) / 10 },
      {
        onSettled: () => {
          setDragging(null);
        },
      },
    );
  };

  return {
    canEdit,
    status,
    paused,
    isLoading: !status && stats.isPending,
    isError: !status && stats.isError,
    ticksPerSecond: stats.data?.market.ticksPerSecond ?? 0,
    clients: stats.data?.connectedClients ?? 0,
    volatility: dragging ?? status?.volatility ?? MARKET_VOLATILITY.default,
    lastChange: lastChange && {
      who: shortActor(lastChange.actorEmail),
      action: lastChange.action,
      at: Date.parse(lastChange.createdAt),
      now: stats.dataUpdatedAt,
    },
    isSaving: command.isPending,
    failed: command.isError,
    ticker: ticker.rows,
    tickerLoading: ticker.isLoading,
    drop: { open: dropOpen, text: dropText, confirmed: dropText === DROP_WORD, dropped },
    actions: {
      retry: () => void stats.refetch(),
      toggleMarket: () => {
        command.mutate({ action: paused ? 'resume' : 'pause' });
      },
      dragVolatility: setDragging,
      setVolatility,
      openDrop: () => {
        setDropText('');
        setDropOpen(true);
      },
      closeDrop: () => {
        setDropOpen(false);
      },
      setDropText,
      confirmDrop: () => {
        if (dropText !== DROP_WORD) return;
        command.mutate(
          { action: 'dropConnections', confirm: DROP_WORD },
          {
            onSuccess: (result) => {
              setDropped(result.dropped ?? 0);
              setDropOpen(false);
            },
          },
        );
      },
    },
  };
}

export type MarketPageModel = ReturnType<typeof useMarketPage>;
