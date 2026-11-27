/**
 * @jest-environment node
 */
import nextConfig from '../next.config';
import robots from '../src/app/robots';

async function headersFor(path: string) {
  const rules = (await nextConfig.headers?.()) ?? [];
  return Object.fromEntries(
    rules
      .filter((rule) => new RegExp(`^${rule.source.replace(':path*', '.*')}$`).test(path))
      .flatMap((rule) => rule.headers.map(({ key, value }) => [key, value])),
  );
}

describe('admin next config', () => {
  it('sends security headers and keeps every page out of search engines', async () => {
    const headers = await headersFor('/overview');

    expect(nextConfig.poweredByHeader).toBe(false);
    expect(headers).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=\d+/);
  });

  it('sends the renamed boards to their new homes', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];

    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: '/users', destination: '/team' }),
        expect.objectContaining({ source: '/accounts', destination: '/customers' }),
      ]),
    );
  });

  it('tells crawlers to stay out entirely', () => {
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });
});
