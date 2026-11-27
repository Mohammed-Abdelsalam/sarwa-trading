import { type ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ProblemDetailsFilter } from '../../src/common/problem-details.filter';

function respond(exception: unknown) {
  const response = { status: jest.fn(), type: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  response.type.mockReturnValue(response);
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as ArgumentsHost;
  new ProblemDetailsFilter().catch(exception, host);
  return response.json.mock.calls[0]?.[0] as { status: number; code: string };
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('failed', { code, clientVersion: 'test' });

describe('ProblemDetailsFilter', () => {
  it.each([
    ['P2025', 404, 'NOT_FOUND'],
    ['P2002', 409, 'CONFLICT'],
    ['P2003', 409, 'CONFLICT'],
  ])('maps Prisma %s to %i %s', (code, status, problem) => {
    expect(respond(prismaError(code))).toMatchObject({ status, code: problem });
  });
});
