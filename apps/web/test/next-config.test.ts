/**
 * @jest-environment node
 */
import nextConfig from '../next.config';

describe('web next config', () => {
  it('sends security headers on every page and hides the framework', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((rule) => rule.source === '/:path*');
    const headers = Object.fromEntries(all?.headers.map(({ key, value }) => [key, value]) ?? []);

    expect(nextConfig.poweredByHeader).toBe(false);
    expect(headers).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    expect(headers['Permissions-Policy']).toContain('camera=()');
  });
});
