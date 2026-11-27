import { addRecent, parseRecent } from '../../../src/features/search/use-search-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

describe('recent searches', () => {
  it('keeps the latest first, without duplicates, capped at six', () => {
    const list = ['A', 'B', 'C', 'D', 'E', 'F'];

    expect(addRecent(list, 'C')).toEqual(['C', 'A', 'B', 'D', 'E', 'F']);
    expect(addRecent(list, 'G')).toEqual(['G', 'A', 'B', 'C', 'D', 'E']);
  });

  it('reads stored lists defensively', () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent('not json')).toEqual([]);
    expect(parseRecent('["AAPL", 3, "NVDA"]')).toEqual(['AAPL', 'NVDA']);
  });
});
