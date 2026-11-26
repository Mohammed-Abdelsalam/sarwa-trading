import { z } from 'zod';

import { DEVICE_ID_HEADER } from '@sarwa/contracts';

import {
  ApiError,
  createApiClient,
  createRequest,
  isNotFound,
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
