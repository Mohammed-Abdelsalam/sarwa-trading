import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { ErrorCode } from '@sarwa/contracts';

import { Clock } from './clock';

export class RateLimitedException extends HttpException {
  constructor(retryAfterMs: number, message = 'Too many attempts, try again later') {
    super(
      {
        code: ErrorCode.RateLimited,
        message,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

// Sliding windows kept in memory: the API runs as a single instance (see the README).
@Injectable()
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly clock: Clock) {}

  consume(key: string, limit: number, windowMs: number): void {
    this.assertAllowed(key, limit, windowMs);
    this.record(key, windowMs);
  }

  assertAllowed(key: string, limit: number, windowMs: number): void {
    const recent = this.recent(key, windowMs);
    const oldest = recent[recent.length - limit];
    if (oldest !== undefined) {
      throw new RateLimitedException(oldest + windowMs - this.clock.now());
    }
  }

  record(key: string, windowMs: number): number {
    const hits = [...this.recent(key, windowMs), this.clock.now()];
    this.hits.set(key, hits);
    return hits.length;
  }

  clear(key: string): void {
    this.hits.delete(key);
  }

  private recent(key: string, windowMs: number): number[] {
    const since = this.clock.now() - windowMs;
    const recent = (this.hits.get(key) ?? []).filter((at) => at > since);
    if (recent.length === 0) this.hits.delete(key);
    return recent;
  }
}
