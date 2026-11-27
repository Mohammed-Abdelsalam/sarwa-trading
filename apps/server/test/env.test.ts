import { parseEnv } from '../src/env';

const base = { DATABASE_URL: 'file:./x.db', JWT_SECRET: 'sixteen-chars-ok' };
const strong = 'k7Gq2vN9xR4tW8zB1mC5yL0pA3sD6fH9';

describe('env', () => {
  it('trusts only the local proxy unless told otherwise', () => {
    expect(parseEnv(base).TRUST_PROXY).toBe('loopback');
    expect(parseEnv({ ...base, TRUST_PROXY: '2' }).TRUST_PROXY).toBe(2);
    expect(parseEnv({ ...base, TRUST_PROXY: '10.0.0.0/8' }).TRUST_PROXY).toBe('10.0.0.0/8');
  });

  it('refuses a short or example JWT secret in production', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: 'dev-only-change-me-to-a-long-random-string',
      }),
    ).toThrow(/JWT_SECRET/);
    expect(parseEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: strong }).JWT_SECRET).toBe(
      strong,
    );
  });
});
