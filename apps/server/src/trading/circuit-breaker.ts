import { Injectable } from '@nestjs/common';

import {
  breakerTrips,
  changeBps,
  type CircuitBreakerRules,
  marketClock,
  type PricePoint,
  scaleBps,
  ticks,
  type Ticks,
  trimWindow,
} from '@sarwa/domain';

const SAMPLE_MS = 1_000;

// Watches recent last prices per symbol on wall time and says when a move is big enough to halt.
@Injectable()
export class CircuitBreaker {
  private readonly windows = new Map<string, PricePoint[]>();
  private trips: { symbol: string; at: number }[] = [];

  // The halt message when this price trips the breaker, otherwise null.
  check(symbol: string, lastTicks: Ticks, now: number, rules: CircuitBreakerRules): string | null {
    if (!rules.enabled) {
      this.windows.delete(symbol);
      return null;
    }
    const window = trimWindow(this.windows.get(symbol) ?? [], now, rules.windowMs);
    if (breakerTrips(window, lastTicks, rules)) {
      this.trips.push({ symbol, at: now });
      return tripMessage(window, lastTicks, rules);
    }
    const latest = window.at(-1);
    if (!latest || now - latest.t >= SAMPLE_MS) window.push({ t: now, ticks: lastTicks });
    this.windows.set(symbol, window);
    return null;
  }

  // Prices aren't sampled while a symbol is halted, so a halt starts and ends with a fresh window.
  reset(symbol: string): void {
    this.windows.delete(symbol);
  }

  tripsToday(now: number): { symbol: string; at: number }[] {
    const today = marketClock(now).date;
    this.trips = this.trips.filter((trip) => marketClock(trip.at).date === today);
    return [...this.trips];
  }
}

function tripMessage(window: PricePoint[], lastTicks: Ticks, rules: CircuitBreakerRules): string {
  const low = ticks(Math.min(...window.map((p) => p.ticks)));
  const high = ticks(Math.max(...window.map((p) => p.ticks)));
  const rose = lastTicks >= scaleBps(low, rules.moveBps, 'up');
  const moveBps = changeBps(rose ? low : high, lastTicks);
  const percent = (Math.abs(moveBps) / 100).toFixed(1);
  const minutes = Math.round(rules.windowMs / 60_000);
  return `Circuit breaker · moved ${moveBps < 0 ? '−' : '+'}${percent}% in ${minutes} min`;
}
