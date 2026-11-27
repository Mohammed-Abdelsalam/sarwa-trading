import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Response } from 'express';

import { ErrorCode, type ErrorCodeValue, type Problem } from '@sarwa/contracts';

import { ValidationException } from './zod-validation.pipe';

const CODE_BY_STATUS: Partial<Record<number, ErrorCodeValue>> = {
  400: ErrorCode.ValidationFailed,
  401: ErrorCode.Unauthorized,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  409: ErrorCode.Conflict,
  429: ErrorCode.RateLimited,
  503: ErrorCode.Maintenance,
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const problem = this.toProblem(exception);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }

  private toProblem(exception: unknown): Problem {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const { message, code } =
        typeof body === 'object'
          ? (body as { message?: unknown; code?: ErrorCodeValue })
          : { message: body };
      return {
        type: 'about:blank',
        title: HttpStatus[status]?.replaceAll('_', ' ') ?? 'Error',
        status,
        code: code ?? CODE_BY_STATUS[status] ?? ErrorCode.Internal,
        detail: Array.isArray(message)
          ? message.join(', ')
          : typeof message === 'string'
            ? message
            : exception.message,
        ...(exception instanceof ValidationException && { errors: exception.errors }),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') return this.simple(404, ErrorCode.NotFound, 'Not found');
      if (exception.code === 'P2002') return this.simple(409, ErrorCode.Conflict, 'Already exists');
      // A row it depends on changed under it, e.g. an order placed while a stock was being deleted.
      if (exception.code === 'P2003') return this.simple(409, ErrorCode.Conflict, 'Still in use');
    }

    this.logger.error(exception);
    return this.simple(500, ErrorCode.Internal, 'Something went wrong');
  }

  private simple(status: number, code: ErrorCodeValue, detail: string): Problem {
    return { type: 'about:blank', title: HttpStatus[status] ?? 'Error', status, code, detail };
  }
}
