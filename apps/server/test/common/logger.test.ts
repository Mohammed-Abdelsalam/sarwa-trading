import { JsonLogger, logLevelsFor } from '../../src/common/logger';

function captured(write: () => void): Record<string, unknown> {
  const stdout = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
  write();
  const line = String(stdout.mock.calls[0]?.[0]);
  return JSON.parse(line) as Record<string, unknown>;
}

describe('JsonLogger', () => {
  it('writes one JSON object per line with its level and context', () => {
    const entry = captured(() => {
      new JsonLogger(['log']).log('Booted', 'Bootstrap');
    });

    expect(entry).toMatchObject({ level: 'log', message: 'Booted', context: 'Bootstrap' });
  });

  it('redacts cookies, auth headers and passwords at any depth', () => {
    const entry = captured(() => {
      new JsonLogger(['log']).log(
        {
          headers: { cookie: 'sarwa_admin=jwt', Authorization: 'Bearer jwt' },
          body: { email: 'a@sarwa.dev', password: 'secret' },
        },
        'Http',
      );
    });

    expect(entry.message).toEqual({
      headers: { cookie: '[redacted]', Authorization: '[redacted]' },
      body: { email: 'a@sarwa.dev', password: '[redacted]' },
    });
  });

  it('stays quiet in tests except for errors', () => {
    expect(logLevelsFor('test')).toEqual(['fatal', 'error']);
  });
});
