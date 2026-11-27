import { Global, Injectable, Module } from '@nestjs/common';

// Injected so tests can control time (sessions, expiry, breaker windows, halts).
@Injectable()
export class Clock {
  now(): number {
    return Date.now();
  }
}

@Global()
@Module({ providers: [Clock], exports: [Clock] })
export class ClockModule {}
