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

import { ErrorCode, type Problem } from '@sarwa/contracts';

import { ValidationException } from './zod-validation.pipe';

const CODE_BY_STATUS: Record<number, string> = {
  400: ErrorCode.ValidationFailed,
  401: ErrorCode.Unauthorized,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  409: ErrorCode.Conflict,
  429: ErrorCode.RateLimited,
  503: ErrorCode.Maintenance,
};

/**
 * Every error leaves the API as an RFC 9457 problem document with a stable `code`.
 * Unexpected errors are logged server-side and returned without details or stack traces.
 */
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
          ? (body as { message?: unknown; code?: string })
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

    // Prisma: record not found / unique constraint → proper HTTP statuses instead of 500.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') return this.simple(404, ErrorCode.NotFound, 'Not found');
      if (exception.code === 'P2002') return this.simple(409, ErrorCode.Conflict, 'Already exists');
    }

    this.logger.error(exception);
    return this.simple(500, ErrorCode.Internal, 'Something went wrong');
  }

  private simple(status: number, code: string, detail: string): Problem {
    return { type: 'about:blank', title: HttpStatus[status] ?? 'Error', status, code, detail };
  }
}
