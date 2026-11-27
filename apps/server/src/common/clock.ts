import { Global, Injectable, Module } from '@nestjs/common';

// Injected so tests can control time (sessions, expiry, breaker windows, halts).
@Injectable()
export class Clock {
  now(): number {
    return Date.now();
  }
}

// Runs recurring work (price ticks, housekeeping); pinned tests swap in one that never fires.
@Injectable()
export class Ticker {
  every(ms: number, task: () => void): () => void {
    const timer = setInterval(task, ms);
    return () => {
      clearInterval(timer);
    };
  }
}

@Global()
@Module({ providers: [Clock, Ticker], exports: [Clock, Ticker] })
export class ClockModule {}
