import { type INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { type Application } from 'express';
import helmet from 'helmet';

import { API_PREFIX } from '@sarwa/contracts';

import { AppModule } from './app.module';
import { JsonLogger, logLevelsFor, requestId } from './common/logger';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { env } from './env';

export function configureApp(app: INestApplication): INestApplication {
  const logger = new JsonLogger(logLevelsFor(env.NODE_ENV));
  app.useLogger(logger);
  // By default only the admin's Next.js rewrite on this machine may set X-Forwarded-For, so direct
  // clients can't spoof their IP. Behind a load balancer, set TRUST_PROXY to its hops or addresses.
  (app.getHttpAdapter().getInstance() as Application).set('trust proxy', env.TRUST_PROXY);
  app.use(requestId(logger));
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();
  return app;
}

async function bootstrap(): Promise<void> {
  // Module start-up logs come before configureApp, so they need the JSON logger too.
  Logger.overrideLogger(new JsonLogger(logLevelsFor(env.NODE_ENV)));
  const app = configureApp(await NestFactory.create(AppModule));
  // 0.0.0.0 so a phone on the same Wi-Fi can reach the API.
  await app.listen(env.PORT, '0.0.0.0');
  Logger.log(`API on http://localhost:${env.PORT}/${API_PREFIX}`, 'Bootstrap');
}

if (require.main === module) void bootstrap();
