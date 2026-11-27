import { type ArgumentsHost, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ProblemDetailsFilter } from '../../src/common/problem-details.filter';
import { RateLimitedException } from '../../src/common/rate-limiter';

function respond(exception: unknown) {
  const response = { status: jest.fn(), type: jest.fn(), json: jest.fn(), setHeader: jest.fn() };
  response.status.mockReturnValue(response);
  response.type.mockReturnValue(response);
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as ArgumentsHost;
  new ProblemDetailsFilter().catch(exception, host);
  return {
    body: response.json.mock.calls[0]?.[0] as Record<string, unknown>,
    headers: Object.fromEntries(response.setHeader.mock.calls as [string, unknown][]),
  };
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('failed', { code, clientVersion: 'test' });

describe('ProblemDetailsFilter', () => {
  it.each([
    ['P2025', 404, 'NOT_FOUND'],
    ['P2002', 409, 'CONFLICT'],
    ['P2003', 409, 'CONFLICT'],
  ])('maps Prisma %s to %i %s', (code, status, problem) => {
    expect(respond(prismaError(code)).body).toMatchObject({ status, code: problem });
  });

  it('keeps the extra fields a problem carries next to the standard ones', () => {
    const { body } = respond(
      new ConflictException({ code: 'GUEST_DATA_PRESENT', message: 'Guest data', ticket: 't1' }),
    );

    expect(body).toMatchObject({
      status: 409,
      code: 'GUEST_DATA_PRESENT',
      detail: 'Guest data',
      ticket: 't1',
    });
  });

  it('tells a rate-limited client when to retry, in the header and the body', () => {
    const { body, headers } = respond(new RateLimitedException(41_200));

    expect(body).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 42 });
    expect(headers).toEqual({ 'Retry-After': '42' });
  });
});
