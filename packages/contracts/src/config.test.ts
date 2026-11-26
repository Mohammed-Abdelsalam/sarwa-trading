import { AppConfigSchema, DEFAULT_APP_CONFIG, UpdateAppConfigSchema } from './config';
import { BANNER_MAX_LENGTH } from './constants';

const config = { ...DEFAULT_APP_CONFIG, updatedAt: 0 };

describe('AppConfigSchema', () => {
  it('accepts the default config', () => {
    expect(AppConfigSchema.safeParse(config).success).toBe(true);
  });

  it('accepts a banner with a tone and trims the message', () => {
    const parsed = AppConfigSchema.parse({
      ...config,
      banner: { message: '  Markets close early today.  ', tone: 'warning' },
    });
    expect(parsed.banner?.message).toBe('Markets close early today.');
  });

  it(`rejects a banner longer than ${BANNER_MAX_LENGTH} characters`, () => {
    const banner = { message: 'x'.repeat(BANNER_MAX_LENGTH + 1), tone: 'info' };
    expect(AppConfigSchema.safeParse({ ...config, banner }).success).toBe(false);
  });

  it('rejects turning every chart period off', () => {
    const result = AppConfigSchema.safeParse({ ...config, enabledPeriods: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('At least one chart period must stay enabled');
  });

  it('rejects duplicate periods', () => {
    expect(AppConfigSchema.safeParse({ ...config, enabledPeriods: ['1D', '1D'] }).success).toBe(
      false,
    );
  });
});

describe('UpdateAppConfigSchema', () => {
  it('accepts a partial update and ignores a client-sent updatedAt', () => {
    const parsed = UpdateAppConfigSchema.parse({ maintenanceMode: true, updatedAt: 123 });
    expect(parsed).toEqual({ maintenanceMode: true });
  });
});
