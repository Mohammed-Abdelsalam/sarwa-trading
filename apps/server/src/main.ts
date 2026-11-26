import { type INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { API_PREFIX } from '@sarwa/contracts';

import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { env } from './env';

/** Shared by main() and the e2e tests so tests run the exact production setup. */
export function configureApp(app: INestApplication): INestApplication {
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();
  return app;
}

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  await app.listen(env.PORT, '0.0.0.0'); // 0.0.0.0 so a phone on the same Wi-Fi can reach it
  Logger.log(`API on http://localhost:${env.PORT}/${API_PREFIX}`, 'Bootstrap');
}

if (require.main === module) void bootstrap();
