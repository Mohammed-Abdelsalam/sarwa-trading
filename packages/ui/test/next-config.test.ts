/**
 * @jest-environment node
 */
import { createServer, type IncomingHttpHeaders, request } from 'node:http';
import { type AddressInfo } from 'node:net';

import { contentSecurityPolicy, forwardClientAddress } from '../next-config.cjs';

// What a server behind forwardClientAddress sees for one request sent with these headers.
async function forwardedFor(headers: Record<string, string>): Promise<IncomingHttpHeaders> {
  let seen: IncomingHttpHeaders = {};
  const server = createServer((req, res) => {
    seen = req.headers;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve, reject) => {
    request({ port, host: '127.0.0.1', headers }, (res) => {
      res.resume().on('end', resolve);
    })
      .on('error', reject)
      .end();
  });
  await new Promise((resolve) => server.close(resolve));
  return seen;
}

describe('forwardClientAddress', () => {
  beforeAll(() => {
    forwardClientAddress();
    // A second call (dev reloads instrumentation) must not append the address twice.
    forwardClientAddress();
  });

  it('records the socket address when the client sends no X-Forwarded-For', async () => {
    expect((await forwardedFor({}))['x-forwarded-for']).toBe('127.0.0.1');
  });

  it('appends the socket address to a client-sent chain, so the last hop is always real', async () => {
    const headers = await forwardedFor({ 'x-forwarded-for': '203.0.113.77' });

    expect(headers['x-forwarded-for']).toBe('203.0.113.77, 127.0.0.1');
  });
});

const directives = (policy: string) =>
  Object.fromEntries(
    policy.split('; ').map((directive) => {
      const [name = '', ...values] = directive.split(' ');
      return [name, values];
    }),
  );

describe('contentSecurityPolicy', () => {
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

  it('keeps every connection same-origin when the app reaches the API only through its rewrite', () => {
    const csp = directives(contentSecurityPolicy({ nonce: 'abc' }));

    expect(csp['connect-src']).toEqual(["'self'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
  });
});
