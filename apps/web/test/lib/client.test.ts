import { createBrowserClient, tabStorage } from '../../src/lib/client';

describe('browser client', () => {
  it('signs customers in with cookies and echoes the CSRF cookie on mutations', async () => {
    document.cookie = 'sarwa_csrf=token-1';
    const { auth } = createBrowserClient();

    expect(auth?.transport.platform).toBe('web');
    expect(auth?.transport.credentials).toBe('include');
    await expect(auth?.transport.headers({ method: 'POST' })).resolves.toMatchObject({
      'x-csrf-token': 'token-1',
    });
    expect(auth?.session.getState().status).toBe('loading');
  });

  it('keeps a gated action for this tab only', async () => {
    const { auth } = createBrowserClient();
    await auth?.intents.save({ kind: 'portfolio' });

    expect(window.sessionStorage.getItem('sarwa.authIntent')).toContain('portfolio');
    expect(window.localStorage.getItem('sarwa.authIntent')).toBeNull();
    await expect(auth?.intents.take()).resolves.toEqual({ kind: 'portfolio' });
  });

  it('forgets the intent when the browser blocks session storage', async () => {
    const blocked = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    await expect(tabStorage.setItem('k', 'v')).resolves.toBeUndefined();
    await expect(tabStorage.getItem('k')).resolves.toBeNull();
    blocked.mockRestore();
    jest.restoreAllMocks();
  });
});
