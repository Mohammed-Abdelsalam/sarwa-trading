import { themes } from '../src/colors';
import {
  BANNER_TONES,
  BUTTON_VARIANTS,
  componentRadius,
  componentSpacing,
  componentTypography,
  ICON_BUTTON_SIZES,
} from '../src/components';
import { buildWebThemeCss } from '../src/css';
import { radius } from '../src/scale';
import preset from '../src/tailwind-preset';

describe('canonical component variants', () => {
  it('uses the canvas names, e.g. danger for the destructive button and warn for warning banners', () => {
    expect(BUTTON_VARIANTS).toContain('danger');
    expect(BANNER_TONES).toEqual(['info', 'warn', 'neutral', 'brand']);
    expect(ICON_BUTTON_SIZES).toEqual([32, 40, 44]);
  });
});

describe('component tokens', () => {
  it('never shadow a Foundations radius', () => {
    const scale = new Set<number>(Object.values(radius));
    for (const value of Object.values(componentRadius)) expect(scale.has(value)).toBe(false);
  });

  it('are emitted for the web as Tailwind theme keys', () => {
    const css = buildWebThemeCss();

    expect(css).toContain('--spacing-pill-sm: 1.375rem;');
    expect(css).toContain('--radius-control-lg: 0.75rem;');
    expect(css).toContain('--container-dialog: 27.5rem;');
    expect(css).toMatch(/@utility type-button \{[^}]*font-weight: 600;/);
    expect(css).toMatch(/@utility skeleton-shimmer \{[^}]*var\(--sarwa-skel-a\)/);
  });

  it('are the same keys in the mobile preset', () => {
    expect(preset.theme.extend.spacing['pill-sm']).toBe(`${componentSpacing['pill-sm']}px`);
    expect(preset.theme.extend.borderRadius['control-lg']).toBe('12px');
    expect(preset.theme.extend.borderRadius.lg).toBe('14px');
  });
});

describe('component type', () => {
  it('sizes the keypad digits and the Home equity number as on the canvas', () => {
    expect(componentTypography.keypad).toMatchObject({ size: 24, weight: 500, tabular: true });
    expect(componentTypography['display-equity']).toMatchObject({ size: 34, lineHeight: 40 });
    expect(buildWebThemeCss()).toMatch(/@utility type-display-equity \{[^}]*font-size: 2.125rem;/);
  });
});

describe('skeleton colours', () => {
  it('come from the canvas in both themes', () => {
    expect(themes.dark['skel-a']).toBe('#222836');
    expect(themes.light['skel-b']).toBe('#D5DAE4');
  });
});
