import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { type z } from 'zod';

import { ErrorCode } from '@sarwa/contracts';

/** Thrown for invalid input; the problem-details filter turns `errors` into per-field messages. */
export class ValidationException extends BadRequestException {
  constructor(readonly errors: Record<string, string[]>) {
    super({ code: ErrorCode.ValidationFailed, message: 'Some fields are invalid' });
  }
}

export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.') || '_';
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}

/**
 * Validates and parses a request part with a schema from @sarwa/contracts, so the server and
 * the clients enforce exactly the same rules:  @Body(new ZodValidationPipe(LoginRequestSchema))
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new ValidationException(toFieldErrors(result.error));
    return result.data;
  }
}
