import { type Period } from '@sarwa/contracts';
import {
  type ChartType,
  direction,
  parseChartType,
  parsePeriod,
  resolvePeriod,
  similarStocks,
  spreadBps,
  toTradeQuote,
  useEnabledPeriods,
  useLiveStatus,
  useOrders,
  usePortfolio,
  useStockDetail,
  useStocks,
  useWatchToggle,
  watchLabel,
} from '@sarwa/core';

import { replaceSearchParam, useSearchParam } from '../../lib/browser';
import { useCopy } from '../../lib/i18n';

// The header buttons are a client island inside the server-rendered heading.
export function useStockActions(symbol: string) {
  const { t } = useCopy();
  const { watched, toggle } = useWatchToggle(symbol);
  return {
    watched,
    toggleWatch: toggle,
    labels: {
      alert: t.stock.alert,
      watch: watched ? t.stock.watching : t.stock.watch,
      watchA11y: watchLabel(t, symbol, watched),
    },
  };
}

// Period and chart type live in the URL (?period=1M&type=candle) so a view can be shared (W-Detail).
export function useStockDetailPage(symbol: string) {
  const { t, f } = useCopy();
  const detail = useStockDetail(symbol);
  const { watched, toggle } = useWatchToggle(symbol);
  const status = useLiveStatus();
  const enabledPeriods = useEnabledPeriods();
  const stocks = useStocks();
  const portfolio = usePortfolio();
  const openOrders = useOrders({ filter: 'open', symbol });
  const period = resolvePeriod(enabledPeriods, parsePeriod(useSearchParam('period')));
  const type = parseChartType(useSearchParam('type'));
  const position = portfolio.summary?.positions.find((p) => p.symbol === symbol);
  const openCount = openOrders.data?.items.length ?? 0;
  const book = detail.quote ? toTradeQuote(detail.quote) : null;
  const sectorLabel = detail.stock ? t.sectors[detail.stock.sector] : undefined;

  return {
    ...detail,
    watched,
    live: status === 'live',
    similar: similarStocks(stocks.data ?? [], symbol),
    chart: { period, type, enabledPeriods },
    quoteLine:
      book && detail.quote
        ? [
            t.ticket.bid({ price: f.price(book.bidTicks), size: f.number(detail.quote.bidSize) }),
            t.ticket.ask({ price: f.price(book.askTicks), size: f.number(detail.quote.askSize) }),
            t.ticket.spread({ pct: f.percent(spreadBps(book)) }),
          ].join(' · ')
        : null,
    position: position
      ? {
          title: t.portfolio.yourPosition,
          openOrders: openCount > 0 ? t.portfolio.openOrdersLink(f.count(openCount)) : null,
          stats: [
            { label: t.portfolio.columns.shares, value: f.shares(position.qtyMicros) },
            { label: t.portfolio.columns.avgCost, value: f.price(position.averageCostTicks) },
            { label: t.portfolio.columns.marketValue, value: f.money(position.marketValueCents) },
            {
              label: t.portfolio.columns.today,
              value: f.money(position.todayCents, { signed: true }),
              direction: direction(position.todayCents),
            },
            {
              label: t.portfolio.columns.totalReturn,
              value: `${f.money(position.unrealizedCents, { signed: true })} (${f.percent(position.totalReturnBps, { signed: true })})`,
              direction: direction(position.unrealizedCents),
            },
          ],
        }
      : null,
    labels: {
      similar: sectorLabel ? t.stock.moreIn({ sector: sectorLabel }) : t.stock.moreInSector,
      loadError: t.stock.loadError({ symbol }),
      loadErrorBody: t.common.loadErrorBody,
      retry: t.common.retry,
    },
    actions: {
      toggleWatch: toggle,
      retry: detail.retry,
      setPeriod: (next: Period) => {
        replaceSearchParam('period', next === '1D' ? null : next);
      },
      setChartType: (next: ChartType) => {
        replaceSearchParam('type', next === 'area' ? null : next);
      },
    },
  };
}
