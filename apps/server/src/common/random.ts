import { Global, Injectable, Module } from '@nestjs/common';

// Injected like Clock so tests can pin the simulator's random walk.
@Injectable()
export class Random {
  next(): number {
    return Math.random();
  }
}

// Its own source so tests can pin fills to zero slippage without freezing prices.
@Injectable()
export class SlippageRandom extends Random {}

@Global()
@Module({ providers: [Random, SlippageRandom], exports: [Random, SlippageRandom] })
export class RandomModule {}
