import { useMemo } from 'react';

import { type Sector, type StockWithQuote } from '@sarwa/contracts';
import { useStocks } from '@sarwa/core';

export type SectorOf = (symbol: string) => Sector | undefined;

export function useStockIndex(): {
  stocks: StockWithQuote[];
  sectorOf: SectorOf;
  nameOf: (symbol: string) => string | undefined;
} {
  const { data } = useStocks();
  return useMemo(() => {
    const stocks = data ?? [];
    const bySymbol = new Map(stocks.map((stock) => [stock.symbol, stock]));
    return {
      stocks,
      sectorOf: (symbol) => bySymbol.get(symbol)?.sector,
      nameOf: (symbol) => bySymbol.get(symbol)?.name,
    };
  }, [data]);
}
