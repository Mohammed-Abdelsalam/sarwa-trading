import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';
const SECRET_KEY = /cookie|authorization|password/i;

const requestContext = new AsyncLocalStorage<{ requestId: string }>();

// One JSON object per line, tagged with the current request id and with secrets redacted.
export class JsonLogger extends ConsoleLogger {
  constructor(logLevels: LogLevel[]) {
    super({ json: true, colors: false, logLevels });
  }

  protected override getJsonLogObject(
    message: unknown,
    options: Parameters<ConsoleLogger['getJsonLogObject']>[1],
  ): ReturnType<ConsoleLogger['getJsonLogObject']> {
    const requestId = requestContext.getStore()?.requestId;
    return { ...super.getJsonLogObject(message, options), ...(requestId && { requestId }) };
  }

  protected override stringifyReplacer(key: string, value: unknown): unknown {
    return SECRET_KEY.test(key) ? '[redacted]' : super.stringifyReplacer(key, value);
  }
}

export const logLevelsFor = (nodeEnv: string): LogLevel[] =>
  nodeEnv === 'test' ? ['fatal', 'error'] : ['fatal', 'error', 'warn', 'log'];

// Reuses a sane incoming id (from a proxy) so one request can be followed across services.
export function requestId(logger: JsonLogger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.header(REQUEST_ID_HEADER);
    const id = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
    const started = performance.now();
    res.setHeader(REQUEST_ID_HEADER, id);
    res.on('finish', () => {
      logger.log(
        {
          requestId: id,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms: Math.round(performance.now() - started),
        },
        'Http',
      );
    });
    requestContext.run({ requestId: id }, next);
  };
}
