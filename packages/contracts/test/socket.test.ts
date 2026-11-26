import { MAX_SUBSCRIBE_SYMBOLS } from '../src/constants';
import {
  StocksChangedEventSchema,
  SubscribeAckSchema,
  SubscribePayloadSchema,
} from '../src/socket';

const letter = (n: number): string => String.fromCharCode(65 + n);

const symbols = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => letter(Math.floor(i / 26)) + letter(i % 26));

describe('SubscribePayloadSchema', () => {
  it('accepts between 1 and the max symbols', () => {
    expect(SubscribePayloadSchema.safeParse({ symbols: ['AAPL'] }).success).toBe(true);
    expect(
      SubscribePayloadSchema.safeParse({ symbols: symbols(MAX_SUBSCRIBE_SYMBOLS) }).success,
    ).toBe(true);
  });

  it('rejects an empty list', () => {
    expect(SubscribePayloadSchema.safeParse({ symbols: [] }).success).toBe(false);
  });

  it(`rejects more than ${MAX_SUBSCRIBE_SYMBOLS} symbols`, () => {
    const result = SubscribePayloadSchema.safeParse({
      symbols: symbols(MAX_SUBSCRIBE_SYMBOLS + 1),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain(String(MAX_SUBSCRIBE_SYMBOLS));
  });

  it('rejects malformed symbols', () => {
    expect(SubscribePayloadSchema.safeParse({ symbols: ['aapl'] }).success).toBe(false);
  });
});

describe('SubscribeAckSchema', () => {
  it('narrows on ok', () => {
    const ack = SubscribeAckSchema.parse({ ok: false, error: { code: 'X', message: 'nope' } });
    expect(ack.ok ? 'quotes' : ack.error.code).toBe('X');
  });
});

describe('StocksChangedEventSchema', () => {
  it('accepts a timestamp and rejects anything else', () => {
    expect(StocksChangedEventSchema.safeParse({ at: 1_700_000_000_000 }).success).toBe(true);
    expect(StocksChangedEventSchema.safeParse({ at: -1 }).success).toBe(false);
    expect(StocksChangedEventSchema.safeParse({}).success).toBe(false);
  });
});
