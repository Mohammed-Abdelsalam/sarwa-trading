import { z } from 'zod';

import {
  DEVICE_ID_HEADER,
  ErrorCode,
  GuestDataPresentProblemSchema,
  RateLimitedProblemSchema,
} from '@sarwa/contracts';

import {
  ApiError,
  createApiClient,
  createRequest,
  isApiError,
  problemDetails,
  queryString,
  shouldRetry,
  TimeoutError,
} from '../src/api';
import { makeQuote } from './utils';

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

const notFound = new ApiError({
  type: 'about:blank',
  title: 'Not found',
  status: 404,
  code: ErrorCode.NotFound,
});
const unavailable = new ApiError({
  type: 'about:blank',
  title: 'Down',
  status: 503,
  code: ErrorCode.Unavailable,
});

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

  it('sends the auth headers and credentials and reports a 401 to the auth slot', async () => {
    const fetchMock = jest.fn((_url: string, _init: RequestInit) =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.reject(new Error('html')),
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const onUnauthorized = jest.fn();
    const request = createRequest({
      baseUrl: 'http://api',
      auth: { headers: () => ({ 'x-test': '1' }), credentials: 'include', onUnauthorized },
    });

    const error: unknown = await request('/me', z.unknown()).catch((e: unknown) => e);

    expect(isApiError(error, ErrorCode.Unauthorized)).toBe(true);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      headers: expect.objectContaining({ 'x-test': '1' }) as unknown,
    });
  });

  function answers(...statuses: number[]): jest.Mock {
    const queue = [...statuses];
    return jest.fn((_url: string, _init: RequestInit) => {
      const status = queue.shift() ?? 200;
      return Promise.resolve({
        ok: status < 400,
        status,
        statusText: '',
        json: () => Promise.resolve({ ok: true }),
      });
    });
  }

  it('renews the session once after a 401 and sends the request again', async () => {
    const fetchMock = answers(401, 200);
    global.fetch = fetchMock;
    const refresh = jest.fn(() => Promise.resolve(true));
    const onUnauthorized = jest.fn();
    const request = createRequest({ baseUrl: 'http://api', auth: { refresh, onUnauthorized } });

    await expect(request('/me', z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('gives up after one renewal, or when the session cannot be renewed', async () => {
    global.fetch = answers(401, 401);
    const onUnauthorized = jest.fn();
    const renewed = createRequest({
      baseUrl: 'http://api',
      auth: { refresh: () => Promise.resolve(true), onUnauthorized },
    });
    await expect(renewed('/me', null)).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    global.fetch = answers(401);
    const expired = createRequest({
      baseUrl: 'http://api',
      auth: { refresh: () => Promise.resolve(false), onUnauthorized },
    });
    await expect(expired('/me', null)).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
  });

  it('treats a 401 on an anonymous call as its answer', async () => {
    global.fetch = answers(401);
    const refresh = jest.fn(() => Promise.resolve(true));
    const onUnauthorized = jest.fn();
    const request = createRequest({ baseUrl: 'http://api', auth: { refresh, onUnauthorized } });

    await expect(request('/auth/sign-in', null, { anonymous: true })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('tells the auth headers which method is being sent', async () => {
    global.fetch = answers(200);
    const headers = jest.fn(() => ({}));
    const request = createRequest({ baseUrl: 'http://api', auth: { headers } });

    await request('/me/profile', null, { method: 'PATCH' });
    await request('/me', null);

    expect(headers.mock.calls).toEqual([[{ method: 'PATCH' }], [{ method: 'GET' }]]);
  });

  it('keeps the request id for the error state, and reads text bodies', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'x-request-id': 'req-42' }),
        json: () => Promise.resolve(null),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve('a,b'),
      });
    const request = createRequest({ baseUrl: 'http://api' });

    const error: unknown = await request('/admin/customers', null).catch((e: unknown) => e);
    expect(error).toMatchObject({ requestId: 'req-42', status: 500 });
    await expect(request('/admin/customers/export.csv', 'text')).resolves.toBe('a,b');
  });

  it('keeps the fields a problem carries beyond the standard ones', async () => {
    const problem = {
      type: 'about:blank',
      title: 'Too many',
      status: 429,
      code: ErrorCode.RateLimited,
      retryAfterSeconds: 42,
    };
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 429, json: () => Promise.resolve(problem) }),
    ) as unknown as typeof fetch;
    const request = createRequest({ baseUrl: 'http://api' });

    const error: unknown = await request('/auth/sign-in', null).catch((e: unknown) => e);

    expect(problemDetails(error, RateLimitedProblemSchema)?.retryAfterSeconds).toBe(42);
    expect(problemDetails(error, GuestDataPresentProblemSchema)).toBeNull();
    expect(problemDetails(new Error('x'), RateLimitedProblemSchema)).toBeNull();
  });
});

describe('queryString', () => {
  it('leaves out empty values and encodes the rest', () => {
    expect(queryString({ q: '', period: '1W', cursor: undefined, n: 2 })).toBe('?period=1W&n=2');
    expect(queryString({})).toBe('');
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
      code: ErrorCode.RateLimited,
    });
    expect(shouldRetry(0, tooMany)).toBe(true);
  });
});

describe('isApiError', () => {
  it('matches only an API error with that code', () => {
    expect(isApiError(notFound, ErrorCode.NotFound)).toBe(true);
    expect(isApiError(unavailable, ErrorCode.NotFound)).toBe(false);
    expect(isApiError(new TimeoutError(10), ErrorCode.NotFound)).toBe(false);
  });
});

describe('createApiClient', () => {
  const originalFetch = global.fetch;
  const DEVICE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  const BODIES: Record<string, unknown> = {
    '/api/v1/stocks': { items: [] },
    '/api/v1/stocks/AAPL': {
      stock: { symbol: 'AAPL', name: 'Apple', sector: 'tech', exchange: 'NASDAQ', currency: 'USD' },
      quote: makeQuote(),
      stats: { marketCap: 1, peRatio: null, week52High: 2, week52Low: 1, avgVolume: 1 },
    },
    '/api/v1/stocks/AAPL/candles?period=1W': { symbol: 'AAPL', period: '1W', candles: [] },
    '/api/v1/app-config': {
      maintenanceMode: false,
      banner: null,
      enabledPeriods: ['1D'],
      updatedAt: 1,
    },
    '/api/v1/watchlist': { symbols: ['AAPL'] },
  };

  function fakeServer() {
    const calls: { path: string; method: string; headers: Record<string, string> }[] = [];
    global.fetch = jest.fn((url: string, init: RequestInit) => {
      const path = url.replace('http://api', '');
      calls.push({
        path,
        method: init.method ?? 'GET',
        headers: init.headers as Record<string, string>,
      });
      const body = init.method ? undefined : BODIES[path];
      return Promise.resolve({
        ok: true,
        status: body === undefined ? 204 : 200,
        json: () => Promise.resolve(body),
      });
    }) as unknown as typeof fetch;
    return calls;
  }

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls every endpoint with the right path and method', async () => {
    const calls = fakeServer();
    const api = createApiClient({
      baseUrl: 'http://api/',
      getDeviceId: () => Promise.resolve(DEVICE_ID),
    });

    await api.listStocks();
    await api.getStock('AAPL');
    await api.getCandles('AAPL', '1W');
    await api.getAppConfig();
    await expect(api.getWatchlist()).resolves.toEqual({ symbols: ['AAPL'] });
    await api.addToWatchlist('AAPL');
    await api.removeFromWatchlist('AAPL');

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /api/v1/stocks',
      'GET /api/v1/stocks/AAPL',
      'GET /api/v1/stocks/AAPL/candles?period=1W',
      'GET /api/v1/app-config',
      'GET /api/v1/watchlist',
      'PUT /api/v1/watchlist/AAPL',
      'DELETE /api/v1/watchlist/AAPL',
    ]);
  });

  it('sends the device id header on every request', async () => {
    const calls = fakeServer();
    const api = createApiClient({
      baseUrl: 'http://api',
      getDeviceId: () => Promise.resolve(DEVICE_ID),
    });

    await api.getWatchlist();

    expect(calls[0]?.headers[DEVICE_ID_HEADER]).toBe(DEVICE_ID);
  });

  it('turns an error without a problem body into an ApiError with the HTTP status', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      }),
    ) as unknown as typeof fetch;
    const api = createApiClient({
      baseUrl: 'http://api',
      getDeviceId: () => Promise.resolve(DEVICE_ID),
    });

    const error = await api.listStocks().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 502,
      problem: { title: 'Bad Gateway', code: 'INTERNAL' },
    });
  });
});
