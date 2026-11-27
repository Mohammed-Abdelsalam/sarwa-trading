import { type Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type StockWithQuote } from '@sarwa/contracts';
import {
  changeBps,
  direction,
  DIRECTION_ARROW,
  micros,
  toTradeQuote,
  usePortfolio,
  useStocks,
  useToggleWatchlist,
  useWatchedSymbols,
} from '@sarwa/core';

import { useModKey } from '../../lib/browser';
import { type Copy, useCopy } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { GO_TO } from './use-top-nav';

export type CommandIcon =
  'buy' | 'sell' | 'alert' | 'watch' | 'stock' | 'page' | 'theme' | 'search';
type Verb = 'buy' | 'sell' | 'alert' | 'watch';

export interface Command {
  id: string;
  label: string;
  icon: CommandIcon;
  symbol?: string;
  stock?: Pick<StockWithQuote, 'symbol' | 'sector'>;
  hint?: string;
  shortcut?: string;
  run: () => void;
}

const MAX_STOCKS = 5;

export interface CommandContext {
  query: string;
  stocks: readonly StockWithQuote[];
  owned: (symbol: string) => number | null;
  watched: ReadonlySet<string>;
  copy: Copy;
  go: (href: Route) => void;
  watch: (symbol: string) => void;
  toggleTheme: () => void;
}

// "buy nv" → verb buy, term "nv". The verb may be typed in either language.
function parseQuery(query: string, copy: Copy): { verb: Verb | null; term: string } {
  const [first = '', ...rest] = query.trim().toLowerCase().split(/\s+/);
  const verbs = Object.entries(copy.m.palette.verbs) as [Verb, string][];
  const verb = verbs.find(([key, word]) => first === key || first === word)?.[0] ?? null;
  return { verb, term: (verb ? rest.join(' ') : query).trim().toLowerCase() };
}

function matchStocks(stocks: readonly StockWithQuote[], term: string): StockWithQuote[] {
  if (!term) return [];
  const upper = term.toUpperCase();
  const bySymbol = stocks.filter((s) => s.symbol.startsWith(upper));
  const byName = stocks.filter(
    (s) => !s.symbol.startsWith(upper) && s.name.toLowerCase().includes(term),
  );
  return [...bySymbol, ...byName].slice(0, MAX_STOCKS);
}

export function buildCommands(ctx: CommandContext): { group: string; items: Command[] }[] {
  const { copy, go } = ctx;
  const { t, f, m } = copy;
  const { verb, term } = parseQuery(ctx.query, copy);
  const matches = matchStocks(ctx.stocks, term);
  const top = matches[0];

  const quoteHint = (stock: StockWithQuote) => {
    const quote = toTradeQuote(stock.quote);
    const bps = changeBps(quote.prevCloseTicks, quote.lastTicks);
    return `${f.price(quote.lastTicks)} ${DIRECTION_ARROW[direction(bps)]} ${f.percent(bps, { signed: true })}`;
  };

  const actions: Command[] = [];
  if (top) {
    const { symbol, name } = top;
    const owned = ctx.owned(symbol);
    const all: (Command & { verb: Verb })[] = [
      {
        verb: 'buy',
        id: `buy-${symbol}`,
        icon: 'buy',
        symbol,
        label: m.palette.buy({ symbol, name }),
        hint: quoteHint(top),
        run: () => {
          go(`/stocks/${symbol}?trade=buy` as Route);
        },
      },
      ...(owned
        ? [
            {
              verb: 'sell' as const,
              id: `sell-${symbol}`,
              icon: 'sell' as const,
              symbol,
              label: m.palette.sell({ symbol, name }),
              run: () => {
                go(`/stocks/${symbol}?trade=sell` as Route);
              },
            },
          ]
        : []),
      {
        verb: 'alert',
        id: `alert-${symbol}`,
        icon: 'alert',
        symbol,
        label: m.palette.setAlert({ symbol }),
        run: () => {
          go(`/alerts?new=${symbol}` as Route);
        },
      },
      ...(ctx.watched.has(symbol)
        ? []
        : [
            {
              verb: 'watch' as const,
              id: `watch-${symbol}`,
              icon: 'watch' as const,
              symbol,
              label: t.watchlist.addSymbol({ symbol }),
              run: () => {
                ctx.watch(symbol);
              },
            },
          ]),
    ];
    actions.push(
      ...all.filter((item) => !verb || item.verb === verb).map(({ verb: _, ...item }) => item),
    );
  }

  const stocks: Command[] = matches.map((stock) => {
    const owned = ctx.owned(stock.symbol);
    return {
      id: `stock-${stock.symbol}`,
      icon: 'stock',
      symbol: stock.symbol,
      stock: { symbol: stock.symbol, sector: stock.sector },
      label: `${stock.symbol} · ${stock.name}`,
      ...(owned ? { hint: m.palette.youOwn({ shares: f.shares(micros(owned)) }) } : {}),
      run: () => {
        go(`/stocks/${stock.symbol}` as Route);
      },
    };
  });

  const pages: [Route, string][] = [
    ['/', t.nav.home],
    ['/markets', t.nav.markets],
    ['/portfolio', t.nav.portfolio],
    ['/watchlist', t.nav.watchlist],
    ['/orders', t.nav.orders],
    ['/alerts', t.nav.alerts],
    ['/settings', t.settings.title],
  ];
  const shortcutFor = (href: Route) =>
    Object.entries(GO_TO).find(([, target]) => target === href)?.[0];
  const navigate: Command[] = [
    ...pages.map(([href, label]): Command => {
      const key = shortcutFor(href);
      return {
        id: `go-${href}`,
        icon: 'page',
        label,
        ...(key ? { shortcut: `G ${key.toUpperCase()}` } : {}),
        run: () => {
          go(href);
        },
      };
    }),
    {
      id: 'theme',
      icon: 'theme' as const,
      label: m.palette.toggleTheme,
      shortcut: '⇧ D',
      run: ctx.toggleTheme,
    },
  ].filter((item) => !verb && (!term || item.label.toLowerCase().includes(term)));

  if (term && !verb) {
    navigate.push({
      id: 'search',
      icon: 'search',
      label: m.palette.searchMarkets({ query: ctx.query.trim() }),
      run: () => {
        go(`/markets?q=${encodeURIComponent(ctx.query.trim())}` as Route);
      },
    });
  }

  return [
    { group: m.palette.actions, items: actions },
    { group: m.palette.stocks, items: verb ? [] : stocks },
    { group: m.palette.navigate, items: navigate },
  ];
}

export function useCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const copy = useCopy();
  const { m } = copy;
  const router = useRouter();
  const stocks = useStocks();
  const portfolio = usePortfolio();
  const watched = useWatchedSymbols();
  const { mutate: toggleWatch } = useToggleWatchlist();
  const { toggle: toggleTheme } = useTheme();
  const mod = useModKey();
  const [query, setQuery] = useState('');

  return {
    open,
    query,
    groups: buildCommands({
      query,
      stocks: stocks.data ?? [],
      owned: (symbol) => portfolio.position(symbol)?.qtyMicros ?? null,
      watched,
      copy,
      go: (href) => {
        router.push(href);
      },
      watch: (symbol) => {
        toggleWatch({ symbol, watched: false });
      },
      toggleTheme,
    }),
    labels: {
      label: m.palette.label,
      placeholder: m.palette.placeholder,
      empty: m.palette.empty,
      hints: [
        { keys: '↑↓', label: m.palette.move },
        { keys: '↵', label: m.palette.run },
        { keys: `${mod} K`, label: m.palette.toggle },
      ],
    },
    setQuery,
    setOpen: (next: boolean) => {
      if (!next) setQuery('');
      onOpenChange(next);
    },
  };
}
