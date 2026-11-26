import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { type z } from 'zod';

import { ErrorCode } from '@sarwa/contracts';

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

export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new ValidationException(toFieldErrors(result.error));
    return result.data;
  }
}
