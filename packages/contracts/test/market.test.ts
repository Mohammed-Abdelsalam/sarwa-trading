import {
  CandleSchema,
  MarketStatusSchema,
  QuoteSchema,
  StockStatsSchema,
  SymbolSchema,
} from '../src/market';

const quote = {
  symbol: 'AAPL',
  price: 231.48,
  prevClose: 228.64,
  bid: 231.46,
  ask: 231.5,
  bidSize: 300,
  askSize: 200,
  open: 229.1,
  dayHigh: 232.1,
  dayLow: 228.4,
  volume: 48_200_000,
  ts: 1_764_166_860_000,
  seq: 42,
};

describe('SymbolSchema', () => {
  it.each(['AAPL', 'V', 'BRK.B'])('accepts %s', (symbol) => {
    expect(SymbolSchema.safeParse(symbol).success).toBe(true);
  });

  it.each(['aapl', '', 'TOOLONGSYMBOL', '1ABC', 'AA PL', '.AAPL'])('rejects %j', (symbol) => {
    expect(SymbolSchema.safeParse(symbol).success).toBe(false);
  });
});

describe('QuoteSchema', () => {
  it('accepts a valid quote', () => {
    expect(QuoteSchema.parse(quote)).toEqual(quote);
  });

  it('rejects a non-positive price', () => {
    expect(QuoteSchema.safeParse({ ...quote, price: 0 }).success).toBe(false);
  });

  it('rejects a fractional volume or seq', () => {
    expect(QuoteSchema.safeParse({ ...quote, volume: 1.5 }).success).toBe(false);
    expect(QuoteSchema.safeParse({ ...quote, seq: 1.5 }).success).toBe(false);
  });

  it('strips unknown keys so a server change cannot leak extra fields into the UI', () => {
    expect(QuoteSchema.parse({ ...quote, secret: 'x' })).not.toHaveProperty('secret');
  });
});

describe('StockStatsSchema', () => {
  it('allows a null P/E for loss-making companies', () => {
    const stats = {
      marketCap: 1e11,
      peRatio: null,
      week52High: 37,
      week52Low: 18,
      avgVolume: 64e6,
    };
    expect(StockStatsSchema.safeParse(stats).success).toBe(true);
  });
});

describe('CandleSchema', () => {
  it('requires integer epoch-ms time and positive prices', () => {
    expect(CandleSchema.safeParse({ t: 1, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 }).success).toBe(true);
    expect(CandleSchema.safeParse({ t: 1.2, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 }).success).toBe(
      false,
    );
    expect(CandleSchema.safeParse({ t: 1, o: -1, h: 2, l: 0.5, c: 1.5, v: 10 }).success).toBe(
      false,
    );
  });
});

describe('MarketStatusSchema', () => {
  it('accepts running/paused within the volatility range', () => {
    expect(
      MarketStatusSchema.safeParse({ state: 'paused', volatility: 1.5, since: 0 }).success,
    ).toBe(true);
  });

  it('rejects volatility outside 0.5–3', () => {
    expect(
      MarketStatusSchema.safeParse({ state: 'running', volatility: 4, since: 0 }).success,
    ).toBe(false);
  });
});
