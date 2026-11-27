import { ADMIN_ROUTES, routePath, TRADING_ROUTES } from '../src';

describe('routePath', () => {
  it('returns a route without params as an absolute path', () => {
    expect(routePath(TRADING_ROUTES.notificationsReadAll)).toBe('/notifications/read-all');
  });

  it('fills every param and encodes it', () => {
    expect(routePath(TRADING_ROUTES.cancelOrder, { id: 'ord_1' })).toBe('/orders/ord_1/cancel');
    expect(routePath(ADMIN_ROUTES.resumeHalt, { symbol: 'BRK.B' })).toBe(
      '/admin/halts/BRK.B/resume',
    );
    expect(routePath(ADMIN_ROUTES.user, { id: 'a/b c' })).toBe('/admin/users/a%2Fb%20c');
  });

  it('never writes "undefined" for a param a caller forgot', () => {
    // Only reachable around the types, e.g. from plain JavaScript.
    expect(Reflect.apply(routePath, undefined, [TRADING_ROUTES.order, {}])).toBe('/orders/');
  });

  it('keeps every path relative and unique', () => {
    const paths = [...Object.values(TRADING_ROUTES), ...Object.values(ADMIN_ROUTES)];

    expect(paths.every((path) => !path.startsWith('/'))).toBe(true);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
