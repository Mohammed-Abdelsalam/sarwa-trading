import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';

export async function startApp(): Promise<{ app: INestApplication; url: string }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.listen(0);
  return { app, url: (await app.getUrl()).replace('[::1]', 'localhost') };
}
