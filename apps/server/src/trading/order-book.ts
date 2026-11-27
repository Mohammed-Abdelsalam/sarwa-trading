import { Injectable } from '@nestjs/common';

import { isWorking } from './mappers';

// Ids of working orders by symbol, so a quote only touches the orders it can affect.
@Injectable()
export class OrderBook {
  private readonly bySymbol = new Map<string, Set<string>>();
  private readonly symbolOf = new Map<string, string>();

  sync({ id, symbol, status }: { id: string; symbol: string; status: string }): void {
    if (!isWorking(status)) {
      this.bySymbol.get(this.symbolOf.get(id) ?? symbol)?.delete(id);
      this.symbolOf.delete(id);
      return;
    }
    this.symbolOf.set(id, symbol);
    let ids = this.bySymbol.get(symbol);
    if (!ids) this.bySymbol.set(symbol, (ids = new Set()));
    ids.add(id);
  }

  ids(symbol: string): string[] {
    return [...(this.bySymbol.get(symbol) ?? [])];
  }

  size(): number {
    return this.symbolOf.size;
  }
}
