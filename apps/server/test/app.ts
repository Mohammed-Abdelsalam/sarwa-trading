import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { type Mail, Mailer } from '../src/auth/mailer';
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

// Never fires on its own: tests call market.tick() or engine.scheduleHousekeeping() explicitly.
export class ManualTicker extends Ticker {
  override every(): () => void {
    return () => undefined;
  }
}

// Keeps every email so a test can follow the link in it.
export class CapturingMailer extends Mailer {
  readonly sent: Mail[] = [];

  send(mail: Mail): Promise<void> {
    this.sent.push(mail);
    return Promise.resolve();
  }

  // The token from the newest link of this kind sent to this address.
  tokenFor(to: string, kind: Mail['kind']): string {
    const mail = this.sent.findLast((m) => m.to === to && m.kind === kind);
    const token = mail?.link?.split(/token=|invite\//).at(-1);
    if (!token) throw new Error(`No ${kind} mail to ${to}`);
    return token;
  }
}

// No random walk, no random slippage and no background ticks: every price is set by the test itself.
export const pinned = {
  random: new FixedRandom(0.99),
  slippage: new FixedRandom(0),
  ticker: new ManualTicker(),
};

export async function startApp(
  options: {
    clock?: Clock;
    random?: Random;
    slippage?: Random;
    ticker?: Ticker;
    mailer?: Mailer;
  } = {},
): Promise<{ app: INestApplication; url: string }> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.clock) builder = builder.overrideProvider(Clock).useValue(options.clock);
  if (options.random) builder = builder.overrideProvider(Random).useValue(options.random);
  if (options.ticker) builder = builder.overrideProvider(Ticker).useValue(options.ticker);
  if (options.mailer) builder = builder.overrideProvider(Mailer).useValue(options.mailer);
  if (options.slippage) {
    builder = builder.overrideProvider(SlippageRandom).useValue(options.slippage);
  }
  const app = configureApp((await builder.compile()).createNestApplication());
  await app.listen(0);
  return { app, url: (await app.getUrl()).replace('[::1]', 'localhost') };
}
