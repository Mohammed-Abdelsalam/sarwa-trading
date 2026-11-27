import { resolveApiUrl } from '../../src/lib/api-url';

describe('resolveApiUrl', () => {
  it('uses the configured URL when there is one', () => {
    expect(resolveApiUrl({ configured: 'https://api.example.com', dev: false })).toBe(
      'https://api.example.com',
    );
  });

  it('reaches the dev machine on its LAN IP in development, since a phone has no localhost', () => {
    expect(resolveApiUrl({ hostUri: '192.168.1.7:8081', dev: true })).toBe(
      'http://192.168.1.7:4000',
    );
    expect(resolveApiUrl({ dev: true })).toBe('http://localhost:4000');
  });

  it('refuses to ship a release that talks to a missing or plain-http API', () => {
    expect(() => resolveApiUrl({ hostUri: '192.168.1.7:8081', dev: false })).toThrow(
      /EXPO_PUBLIC_API_URL/,
    );
    expect(() => resolveApiUrl({ configured: 'http://api.example.com', dev: false })).toThrow(
      /https/,
    );
  });
});
