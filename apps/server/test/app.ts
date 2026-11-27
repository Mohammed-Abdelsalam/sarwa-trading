import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { Clock } from '../src/common/clock';
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

export async function startApp(
  options: { clock?: Clock } = {},
): Promise<{ app: INestApplication; url: string }> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.clock) builder = builder.overrideProvider(Clock).useValue(options.clock);
  const app = configureApp((await builder.compile()).createNestApplication());
  await app.listen(0);
  return { app, url: (await app.getUrl()).replace('[::1]', 'localhost') };
}
