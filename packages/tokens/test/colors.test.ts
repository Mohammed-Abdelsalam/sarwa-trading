import {
  COLOR_ROLES,
  contrastRatio,
  isHex,
  SECTORS,
  sectorColors,
  themes,
  type ColorRole,
  type ThemeName,
} from '../src/colors';

const THEMES: ThemeName[] = ['light', 'dark'];
const RGBA = /^rgba\(\d{1,3},\d{1,3},\d{1,3},(0|1|0?\.\d+)\)$/;

describe('contrastRatio', () => {
  it('returns 21 for black on white and is symmetric', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });

  it('throws for a translucent colour (contrast needs an opaque one)', () => {
    expect(() => contrastRatio('rgba(0,0,0,0.5)', '#FFFFFF')).toThrow('opaque hex');
  });
});

describe.each(THEMES)('%s theme', (name) => {
  const theme = themes[name];

  it('defines every role as a hex or rgba colour', () => {
    for (const role of COLOR_ROLES) {
      const value = theme[role];
      expect(isHex(value) || RGBA.test(value)).toBe(true);
    }
  });

  it('defines a text and background colour for every sector avatar', () => {
    for (const sector of SECTORS) {
      expect(sectorColors[name][sector].fg).toMatch(/^#/);
      expect(sectorColors[name][sector].bg).toBeTruthy();
    }
  });

  const textRoles: ColorRole[] = ['fg', 'fg-2', 'fg-3', 'brand-fg', 'pos', 'neg', 'warn', 'info'];
  it.each(textRoles)('gives %s text at least 4.5:1 on surface and bg', (role) => {
    expect(contrastRatio(theme[role], theme.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme[role], theme.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['brand', 'danger'] as const)('gives the white label at least 5:1 on %s', (fill) => {
    expect(contrastRatio(theme['on-brand'], theme[fill])).toBeGreaterThanOrEqual(5);
  });

  it('gives the star at least 3:1 (graphical object) on surface', () => {
    expect(contrastRatio(theme.star, theme.surface)).toBeGreaterThanOrEqual(3);
  });
});
