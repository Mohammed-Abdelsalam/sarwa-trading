import {
  getStockDetail,
  getStocks,
  getTradingStatus,
  SNAPSHOT_REVALIDATE_SECONDS,
} from '../../src/lib/server-api';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

function respond(body: unknown) {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function initOf(call: number): RequestInit & { next?: { revalidate?: number } } {
  return fetchMock.mock.calls[call]?.[1] as RequestInit & { next?: { revalidate?: number } };
}

describe('server api', () => {
  it('serves the stock list from a short-lived snapshot cache', async () => {
    respond({ items: [] });

    await getStocks();

    expect(initOf(0).next).toEqual({ revalidate: SNAPSHOT_REVALIDATE_SECONDS });
  });

  it('serves stock detail from the same snapshot cache', async () => {
    respond({});

    await getStockDetail('AAPL').catch(() => undefined);

    expect(initOf(0).next).toEqual({ revalidate: SNAPSHOT_REVALIDATE_SECONDS });
  });

  it('always reads the trading status fresh', async () => {
    respond({});

    await getTradingStatus().catch(() => undefined);

    expect(initOf(0).cache).toBe('no-store');
    expect(initOf(0).next).toBeUndefined();
  });
});
