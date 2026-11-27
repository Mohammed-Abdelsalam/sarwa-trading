import { contentSecurityPolicy } from '../../src/lib/csp';

const directives = (policy: string) =>
  Object.fromEntries(
    policy.split('; ').map((directive) => {
      const [name = '', ...values] = directive.split(' ');
      return [name, values];
    }),
  );

describe('content security policy', () => {
  it('runs only nonced scripts and talks only to the API over http and ws', () => {
    const csp = directives(
      contentSecurityPolicy({ nonce: 'abc', apiUrl: 'https://api.example.com', https: true }),
    );

    expect(csp['script-src']).toEqual(["'self'", "'nonce-abc'", "'strict-dynamic'"]);
    expect(csp['connect-src']).toEqual([
      "'self'",
      'https://api.example.com',
      'wss://api.example.com',
    ]);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp).toHaveProperty('upgrade-insecure-requests');
  });

  it('allows eval in development and never upgrades plain-http local setups', () => {
    const csp = directives(
      contentSecurityPolicy({ nonce: 'abc', apiUrl: 'http://localhost:4000', dev: true }),
    );

    expect(csp['script-src']).toContain("'unsafe-eval'");
    expect(csp['connect-src']).toContain('ws://localhost:4000');
    expect(csp).not.toHaveProperty('upgrade-insecure-requests');
  });
});
