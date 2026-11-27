import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { Clock, Ticker } from '../src/common/clock';
import { Random, SlippageRandom } from '../src/common/random';
import { configureApp } from '../src/main';

export class FakeClock extends Clock {
  constructor(private time: number) {
    super();
  }

  override now(): number {
    return this.time;
  }

  set(time: number): void {
    this.time = time;
  }

  advance(ms: number): void {
    this.time += ms;
  }
}

export class FixedRandom extends Random {
  constructor(private readonly value: number) {
    super();
  }

  override next(): number {
    return this.value;
  }
}

// Never ticks on its own: the test calls market.tick() when it wants one.
export class ManualTicker extends Ticker {
  override every(): () => void {
    return () => undefined;
  }
}

// No random walk, no random slippage and no background ticks: every price is set by the test itself.
export const pinned = {
  random: new FixedRandom(0.99),
  slippage: new FixedRandom(0),
  ticker: new ManualTicker(),
};

export async function startApp(
  options: { clock?: Clock; random?: Random; slippage?: Random; ticker?: Ticker } = {},
): Promise<{ app: INestApplication; url: string }> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.clock) builder = builder.overrideProvider(Clock).useValue(options.clock);
  if (options.random) builder = builder.overrideProvider(Random).useValue(options.random);
  if (options.ticker) builder = builder.overrideProvider(Ticker).useValue(options.ticker);
  if (options.slippage) {
    builder = builder.overrideProvider(SlippageRandom).useValue(options.slippage);
  }
  const app = configureApp((await builder.compile()).createNestApplication());
  await app.listen(0);
  return { app, url: (await app.getUrl()).replace('[::1]', 'localhost') };
}
