import { safeNext } from '../../src/lib/browser';

describe('safeNext', () => {
  it('keeps a same-site path with its query', () => {
    expect(safeNext('/orders?status=open')).toBe('/orders?status=open');
  });

  it.each([
    ['missing', null],
    ['protocol-relative', '//evil.com'],
    ['tab trick the browser strips', '/\t/evil.com'],
    ['backslash trick', '/\\/evil.com'],
    ['absolute url', 'https://evil.com/overview'],
    ['the login page itself', '/login?next=/overview'],
  ])('falls back to the overview for a %s target', (_, next) => {
    expect(safeNext(next)).toBe('/overview');
  });
});
