import { COLOR_ROLES } from './colors';
import {
  buildNativeThemeCss,
  buildWebThemeCss,
  colorNames,
  cssVarName,
  themeVariables,
} from './css';
import preset from './tailwind-preset';

describe('themeVariables', () => {
  it('maps colour roles, sector colours and shadows to --sarwa-* variables', () => {
    const vars = themeVariables('dark');
    expect(vars['--sarwa-bg']).toBe('#0B0E14');
    expect(vars['--sarwa-pos']).toBe('#3DD68C');
    expect(vars['--sarwa-sector-tech-subtle']).toBe('rgba(99,102,241,0.20)');
    expect(vars['--sarwa-shadow-e2']).toBe('0 8px 24px rgba(0,0,0,0.45)');
  });
});

describe('buildWebThemeCss (Tailwind v4)', () => {
  const css = buildWebThemeCss();

  it('registers every colour as a Tailwind token backed by a runtime variable', () => {
    for (const name of colorNames()) {
      expect(css).toContain(`--color-${name}: var(${cssVarName(name)});`);
    }
  });

  it('switches theme with .dark, .light or the OS preference', () => {
    expect(css).toContain('@custom-variant dark');
    expect(css).toContain(':root.dark {');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(':root:not(.light)');
  });

  it('ships typography utilities with tabular numbers for prices', () => {
    expect(css).toMatch(/@utility type-display \{[^}]*font-variant-numeric: tabular-nums;/);
    expect(css).toMatch(/@utility type-h1 \{[^}]*font-family: var\(--font-display\);/);
  });

  it('replaces the price flash with an underline when reduced motion is requested', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('box-shadow: inset 0 -2px 0 var(--sarwa-pos)');
  });
});

describe('buildNativeThemeCss (NativeWind)', () => {
  it('declares each role once for light and once for dark', () => {
    const css = buildNativeThemeCss();
    for (const role of COLOR_ROLES) {
      expect(css.split(`${cssVarName(role)}:`)).toHaveLength(3);
    }
  });
});

describe('tailwind preset (mobile)', () => {
  it('uses the same class names as the web, backed by the same variables', () => {
    expect(preset.theme.extend.colors.pos).toBe('var(--sarwa-pos)');
    expect(Object.keys(preset.theme.extend.colors)).toEqual(colorNames());
  });

  it('follows the 4pt spacing grid and the design system radii', () => {
    expect(preset.theme.extend.spacing['4']).toBe('16px');
    expect(preset.theme.extend.borderRadius.lg).toBe('14px');
  });
});
