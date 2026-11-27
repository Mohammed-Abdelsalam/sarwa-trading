import {
  AUDIT_ACTIONS,
  AUDIT_GROUPS,
  AuditQuerySchema,
  CreateStockSchema,
  LoginRequestSchema,
  MarketCommandSchema,
  UpdateStockSchema,
  UpdateUserSchema,
} from '../src/admin';
import { AUDIT_PII_RETENTION_DAYS, AUDIT_RETENTION_DAYS } from '../src/constants';

describe('LoginRequestSchema', () => {
  it('accepts a valid email and password', () => {
    expect(
      LoginRequestSchema.safeParse({ email: 'maya@minitrading.dev', password: 'correct-horse' })
        .success,
    ).toBe(true);
  });

  it('returns field messages for the login form', () => {
    const result = LoginRequestSchema.safeParse({ email: 'maya', password: 'short' });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message);
    expect(messages).toEqual([
      'Enter a valid email address',
      'Password must be at least 8 characters',
    ]);
  });
});

describe('MarketCommandSchema', () => {
  it.each([
    { action: 'pause' },
    { action: 'resume' },
    { action: 'setVolatility', volatility: 1.5 },
    { action: 'dropConnections', confirm: 'DROP' },
  ])('accepts %j', (command) => {
    expect(MarketCommandSchema.safeParse(command).success).toBe(true);
  });

  it('requires typing DROP to drop connections', () => {
    expect(MarketCommandSchema.safeParse({ action: 'dropConnections' }).success).toBe(false);
    expect(
      MarketCommandSchema.safeParse({ action: 'dropConnections', confirm: 'drop' }).success,
    ).toBe(false);
  });

  it('rejects volatility outside 0.5–3 and unknown actions', () => {
    expect(
      MarketCommandSchema.safeParse({ action: 'setVolatility', volatility: 0.2 }).success,
    ).toBe(false);
    expect(MarketCommandSchema.safeParse({ action: 'crash' }).success).toBe(false);
  });
});

describe('CreateStockSchema', () => {
  const valid = {
    symbol: 'UNH',
    name: 'UnitedHealth Group',
    sector: 'health',
    exchange: 'NYSE',
    basePrice: 548.2,
    volatility: 1.1,
  };

  it('fills defaults for optional fields', () => {
    expect(CreateStockSchema.parse(valid)).toMatchObject({
      marketCap: 0,
      peRatio: null,
      isEnabled: true,
    });
  });

  it('reports every invalid field at once (dialog shows "Fix 3 fields")', () => {
    const result = CreateStockSchema.safeParse({
      ...valid,
      name: ' ',
      basePrice: 0,
      volatility: 9,
    });
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(['name', 'basePrice', 'volatility']);
  });
});

describe('UpdateStockSchema', () => {
  it('rejects an empty update', () => {
    expect(UpdateStockSchema.safeParse({}).success).toBe(false);
  });

  it('never fills defaults into fields the admin did not touch', () => {
    expect(UpdateStockSchema.parse({ name: 'Intel' })).toEqual({ name: 'Intel' });
  });

  it('does not allow renaming the symbol', () => {
    expect(UpdateStockSchema.parse({ symbol: 'X', isEnabled: false })).toEqual({
      isEnabled: false,
    });
  });
});

describe('UpdateUserSchema', () => {
  it('needs a role or a status', () => {
    expect(UpdateUserSchema.safeParse({}).success).toBe(false);
    expect(UpdateUserSchema.safeParse({ role: 'VIEWER' }).success).toBe(true);
  });
});

describe('AuditQuerySchema', () => {
  it('coerces paging params from the query string', () => {
    expect(AuditQuerySchema.parse({ page: '2', action: 'market.pause' })).toEqual({
      page: 2,
      pageSize: 25,
      action: 'market.pause',
    });
  });

  it('caps pageSize at 100', () => {
    expect(AuditQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });

  it('accepts a known action group and rejects an unknown one', () => {
    expect(AuditQuerySchema.parse({ group: 'customer' }).group).toBe('customer');
    expect(AuditQuerySchema.safeParse({ group: 'devices' }).success).toBe(false);
  });
});

describe('AUDIT_GROUPS', () => {
  it('each filter matches at least one audited action', () => {
    for (const group of AUDIT_GROUPS)
      expect(AUDIT_ACTIONS.some((action) => action.startsWith(`${group}.`))).toBe(true);
  });
});

describe('audit retention', () => {
  it('keeps events for 400 days and their ip and user agent for 90', () => {
    expect({ AUDIT_RETENTION_DAYS, AUDIT_PII_RETENTION_DAYS }).toEqual({
      AUDIT_RETENTION_DAYS: 400,
      AUDIT_PII_RETENTION_DAYS: 90,
    });
    expect(AUDIT_PII_RETENTION_DAYS).toBeLessThan(AUDIT_RETENTION_DAYS);
  });
});
