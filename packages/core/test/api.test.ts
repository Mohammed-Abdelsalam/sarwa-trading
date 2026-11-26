import { z } from 'zod';

import { ApiError, createRequest, isNotFound, shouldRetry, TimeoutError } from '../src/api';

function neverAnswers(): jest.Mock {
  return jest.fn(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        const fail = () => {
          reject(new Error('AbortError'));
        };
        if (init.signal?.aborted) fail();
        init.signal?.addEventListener('abort', fail);
      }),
  );
}

const notFound = new ApiError({ type: 'about:blank', title: 'Not found', status: 404, code: 'X' });
const unavailable = new ApiError({ type: 'about:blank', title: 'Down', status: 503, code: 'X' });

describe('createRequest', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects with a TimeoutError when the server never answers', async () => {
    global.fetch = neverAnswers();
    const request = createRequest({ baseUrl: 'http://api', timeoutMs: 20 });

    await expect(request('/stocks', z.unknown())).rejects.toBeInstanceOf(TimeoutError);
  });

  it('rejects with the caller reason when the caller aborts', async () => {
    global.fetch = neverAnswers();
    const request = createRequest({ baseUrl: 'http://api' });
    const controller = new AbortController();
    const reason = new Error('screen left');

    const pending = request('/stocks', z.unknown(), { signal: controller.signal });
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
  });

  it('parses a successful response with the given schema', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }),
    ) as unknown as typeof fetch;
    const request = createRequest({ baseUrl: 'http://api' });

    await expect(request('/health', z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true });
  });
});

describe('shouldRetry', () => {
  it('does not retry client errors like 404', () => {
    expect(shouldRetry(0, notFound)).toBe(false);
  });

  it('retries server and network errors at most twice', () => {
    expect(shouldRetry(0, unavailable)).toBe(true);
    expect(shouldRetry(1, new TimeoutError(10))).toBe(true);
    expect(shouldRetry(2, unavailable)).toBe(false);
  });

  it('retries rate limits and request timeouts from the server', () => {
    const tooMany = new ApiError({
      type: 'about:blank',
      title: 'Slow down',
      status: 429,
      code: 'X',
    });
    expect(shouldRetry(0, tooMany)).toBe(true);
  });
});

describe('isNotFound', () => {
  it('is true only for a 404 API error', () => {
    expect(isNotFound(notFound)).toBe(true);
    expect(isNotFound(unavailable)).toBe(false);
    expect(isNotFound(new TimeoutError(10))).toBe(false);
  });
});
