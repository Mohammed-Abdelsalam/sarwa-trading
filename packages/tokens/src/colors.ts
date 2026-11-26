/**
 * Semantic color tokens — "Mini Trading UI design system v1.0" (Claude Design canvas).
 *
 * One token set powers all three apps. Components only use these ROLE names
 * (`bg-surface`, `text-fg-2`, `text-pos`…), never raw hex, so dark mode is a variable swap.
 * Dark is the hero theme for trading; light is a full peer.
 *
 * Rule from the design system: price colour is never the only signal — every change also
 * carries ▲ / ▼ or a + / − sign, and the neutral state uses ■ with 0.00%.
 */

export const COLOR_ROLES = [
  // surfaces & lines
  'bg', // app canvas behind everything
  'surface', // cards, lists, nav bars
  'surface-2', // elevated: dialogs, menus, toasts (+ shadow e2/e3)
  'surface-3', // muted: hover rows, segmented track, skeleton
  'border', // dividers, card strokes
  'border-strong', // inputs, chips, focusable outlines
  // text
  'fg', // primary text: prices, titles
  'fg-2', // secondary: body, labels
  'fg-3', // muted: captions, company names
  // brand
  'brand', // primary fills
  'brand-hover',
  'brand-press',
  'brand-fg', // brand-coloured text: links, active tab
  'brand-subtle', // active nav item, brand badge
  'on-brand', // label on brand / danger fills
  // market direction
  'pos', // price up ▲
  'pos-subtle', // ChangePill bg
  'neg', // price down ▼
  'neg-subtle',
  'flat', // unchanged ■ 0.00%
  'flat-subtle',
  'flash-up', // PriceFlash tick up (400 ms fade)
  'flash-down',
  // status
  'warn', // reconnecting, maintenance
  'warn-subtle',
  'info', // remote banners, market paused
  'info-subtle',
  'danger', // destructive fills
  'danger-hover',
  'danger-press',
  'star', // watchlist star on
  // utility
  'focus', // 2 px focus ring, 2 px offset
  'scrim', // behind dialogs & sheets
  'chart-grid',
] as const;

export type ColorRole = (typeof COLOR_ROLES)[number];
export type ThemeName = 'light' | 'dark';
export type ThemeColors = Record<ColorRole, string>;

export const themes: Record<ThemeName, ThemeColors> = {
  dark: {
    bg: '#0B0E14',
    surface: '#121620',
    'surface-2': '#1A1F2B',
    'surface-3': '#222836',
    border: '#262C3A',
    'border-strong': '#363E50',
    fg: '#EDF0F7',
    'fg-2': '#A9B1C3',
    'fg-3': '#7D869A',
    brand: '#5457E8',
    'brand-hover': '#6367F5',
    'brand-press': '#4447C9',
    'brand-fg': '#A3A6FF',
    'brand-subtle': 'rgba(99,102,241,0.18)',
    'on-brand': '#FFFFFF',
    pos: '#3DD68C',
    'pos-subtle': 'rgba(61,214,140,0.14)',
    neg: '#FF6B6B',
    'neg-subtle': 'rgba(255,107,107,0.14)',
    flat: '#A9B1C3',
    'flat-subtle': 'rgba(169,177,195,0.12)',
    'flash-up': 'rgba(61,214,140,0.30)',
    'flash-down': 'rgba(255,107,107,0.30)',
    warn: '#F5B83D',
    'warn-subtle': 'rgba(245,184,61,0.14)',
    info: '#5CC8FF',
    'info-subtle': 'rgba(92,200,255,0.14)',
    danger: '#CC2F3C',
    'danger-hover': '#B92733',
    'danger-press': '#A3212C',
    star: '#F5B83D',
    focus: '#8B8EFF',
    scrim: 'rgba(5,7,12,0.72)',
    'chart-grid': 'rgba(169,177,195,0.10)',
  },
  light: {
    bg: '#F5F6FA',
    surface: '#FFFFFF',
    'surface-2': '#FFFFFF',
    'surface-3': '#EEF0F5',
    border: '#E2E5EE',
    'border-strong': '#C9CED9',
    fg: '#0E1220',
    'fg-2': '#475066',
    'fg-3': '#646C80',
    brand: '#5457E8',
    'brand-hover': '#4A4DDB',
    'brand-press': '#3F42C4',
    'brand-fg': '#4346D6',
    'brand-subtle': '#ECEDFF',
    'on-brand': '#FFFFFF',
    pos: '#087446',
    'pos-subtle': '#E2F4EA',
    neg: '#BF2532',
    'neg-subtle': '#FCE8EA',
    flat: '#475066',
    'flat-subtle': '#EDEFF4',
    'flash-up': 'rgba(8,116,70,0.16)',
    'flash-down': 'rgba(191,37,50,0.14)',
    warn: '#8F5B00',
    'warn-subtle': '#FDF1D8',
    info: '#0A65A0',
    'info-subtle': '#E2F1FB',
    danger: '#CC2F3C',
    'danger-hover': '#B92733',
    'danger-press': '#A3212C',
    star: '#B57A00',
    focus: '#5457E8',
    scrim: 'rgba(14,18,32,0.45)',
    'chart-grid': 'rgba(71,80,102,0.10)',
  },
};

/** Sector avatar colours (the rounded-square ticker initial in every StockRow). */
export const SECTORS = ['tech', 'fin', 'energy', 'health', 'consumer', 'media'] as const;
export type Sector = (typeof SECTORS)[number];

export const sectorColors: Record<ThemeName, Record<Sector, { fg: string; bg: string }>> = {
  dark: {
    tech: { fg: '#B4B6FF', bg: 'rgba(99,102,241,0.20)' },
    fin: { fg: '#8AD8FF', bg: 'rgba(92,200,255,0.16)' },
    energy: { fg: '#F8C96A', bg: 'rgba(245,184,61,0.16)' },
    health: { fg: '#F59BCB', bg: 'rgba(244,114,182,0.16)' },
    consumer: { fg: '#FCAD72', bg: 'rgba(251,146,60,0.16)' },
    media: { fg: '#D3A8FD', bg: 'rgba(192,132,252,0.16)' },
  },
  light: {
    tech: { fg: '#3F42C4', bg: '#ECEDFF' },
    fin: { fg: '#0A65A0', bg: '#E2F1FB' },
    energy: { fg: '#8F5B00', bg: '#FDF1D8' },
    health: { fg: '#A3266A', bg: '#FCE7F3' },
    consumer: { fg: '#A4470A', bg: '#FFEDE0' },
    media: { fg: '#7232B8', bg: '#F3E8FF' },
  },
};

const HEX = /^#([0-9a-f]{6})$/i;

export function isHex(color: string): boolean {
  return HEX.test(color);
}

/** WCAG 2.x relative luminance of an opaque hex colour. */
export function relativeLuminance(hex: string): number {
  const match = HEX.exec(hex);
  if (!match?.[1]) throw new Error(`Expected an opaque hex color, got: ${hex}`);
  const value = Number.parseInt(match[1], 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}
