import { ApiError } from '@sarwa/core/server';

import { generateMetadata as portfolioMetadata } from '../../src/app/portfolio/page';
import robots from '../../src/app/robots';
import sitemap from '../../src/app/sitemap';
import StockPage, { generateMetadata } from '../../src/app/stocks/[symbol]/page';
import { jsonLd } from '../../src/lib/seo';
import { getStockDetail, getStocks } from '../../src/lib/server-api';
import { makeQuote, makeStock } from '../fixtures';

let locale = 'en';
jest.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (name === 'sarwa.locale' ? { value: locale } : undefined),
    }),
}));
jest.mock('../../src/lib/server-api', () => ({ getStocks: jest.fn(), getStockDetail: jest.fn() }));

const notFoundError = new ApiError({
  type: 'about:blank',
  title: 'Not Found',
  status: 404,
  code: 'NOT_FOUND',
});
const props = (symbol: string) =>
  ({ params: Promise.resolve({ symbol }) }) as PageProps<'/stocks/[symbol]'>;
const digest = (run: () => Promise<unknown>) =>
  run().then(
    () => null,
    (error: unknown) => (error as { digest?: string }).digest,
  );

beforeEach(() => {
  locale = 'en';
  jest.mocked(getStockDetail).mockResolvedValue({
    stock: makeStock('AAPL', { name: 'Apple Inc.' }),
    quote: makeQuote({ price: 231.48 }),
  } as unknown as Awaited<ReturnType<typeof getStockDetail>>);
});

describe('crawling', () => {
  it('lets crawlers into the public pages only and points them at the sitemap', () => {
    const { rules, sitemap: map } = robots();

    expect(rules).toMatchObject({
      allow: ['/', '/markets', '/stocks/'],
      disallow: ['/portfolio', '/orders', '/watchlist', '/alerts', '/settings'],
    });
    expect(map).toBe('http://localhost:3000/sitemap.xml');
  });

  it('lists every stock page, and still the public pages when the API is down', async () => {
    jest.mocked(getStocks).mockResolvedValueOnce([makeStock('AAPL'), makeStock('NVDA')]);
    expect((await sitemap()).map((entry) => entry.url)).toEqual([
      'http://localhost:3000',
      'http://localhost:3000/markets',
      'http://localhost:3000/stocks/AAPL',
      'http://localhost:3000/stocks/NVDA',
    ]);

    jest.mocked(getStocks).mockRejectedValueOnce(new Error('down'));
    expect(await sitemap()).toHaveLength(2);
  });

  it('keeps personal pages out of the index', async () => {
    await expect(portfolioMetadata()).resolves.toEqual({
      title: 'Portfolio',
      robots: { index: false, follow: false },
    });
  });

  it('escapes "<" so structured data can never close its script tag', () => {
    expect(jsonLd({ name: '</script><b>' })).not.toContain('<');
  });
});

describe('stock page', () => {
  it('redirects a lowercase symbol to its canonical uppercase URL', async () => {
    expect(await digest(() => StockPage(props('aapl')))).toMatch(
      /^NEXT_REDIRECT;.*\/stocks\/AAPL;308/,
    );
  });

  it('answers an unknown symbol with a real 404', async () => {
    jest.mocked(getStockDetail).mockRejectedValue(notFoundError);

    expect(await digest(() => StockPage(props('ZZZZZ')))).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  it('describes the stock in the reader’s language without a price', async () => {
    locale = 'ar';
    const metadata = await generateMetadata(props('aapl'));

    expect(metadata.alternates?.canonical).toBe('/stocks/AAPL');
    expect(metadata.title).toBe('Apple Inc. (AAPL)');
    expect(metadata.description).toContain('سهم Apple Inc. (AAPL)');
    expect(metadata.description).not.toMatch(/231/);
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});
