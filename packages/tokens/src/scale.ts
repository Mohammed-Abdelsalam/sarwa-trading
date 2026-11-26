/**
 * Non-colour tokens from the design system Foundations board.
 * Numbers are px (React Native uses them as unitless dp; the CSS build adds units).
 */

/** Fonts: Inter (UI + numbers, tabular) · Manrope (headings) · JetBrains Mono (code). */
export const fontFamily = {
  sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
  display: ['Manrope', 'Inter', 'ui-sans-serif', 'sans-serif'],
  mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
} as const;

export interface TypeToken {
  family: keyof typeof fontFamily;
  size: number;
  lineHeight: number;
  weight: 400 | 500 | 600 | 700 | 800;
  /** em, e.g. -0.02 = −2% */
  tracking?: number;
  uppercase?: boolean;
  /** tabular numbers so live ticks never jitter columns */
  tabular?: boolean;
}

export const typography = {
  display: {
    family: 'sans',
    size: 44,
    lineHeight: 48,
    weight: 600,
    tracking: -0.02,
    tabular: true,
  },
  'display-web': {
    family: 'sans',
    size: 56,
    lineHeight: 60,
    weight: 600,
    tracking: -0.025,
    tabular: true,
  },
  h1: { family: 'display', size: 28, lineHeight: 34, weight: 700, tracking: -0.01 },
  h2: { family: 'display', size: 22, lineHeight: 28, weight: 700, tracking: -0.005 },
  h3: { family: 'sans', size: 17, lineHeight: 24, weight: 600 },
  body: { family: 'sans', size: 15, lineHeight: 22, weight: 400 },
  sm: { family: 'sans', size: 13, lineHeight: 18, weight: 400 },
  caption: { family: 'sans', size: 12, lineHeight: 16, weight: 500 },
  overline: {
    family: 'sans',
    size: 11,
    lineHeight: 14,
    weight: 600,
    tracking: 0.06,
    uppercase: true,
  },
  'num-lg': { family: 'sans', size: 20, lineHeight: 24, weight: 600, tabular: true },
  'num-md': { family: 'sans', size: 15, lineHeight: 20, weight: 600, tabular: true },
  'num-sm': { family: 'sans', size: 13, lineHeight: 16, weight: 500, tabular: true },
  mono: { family: 'mono', size: 13, lineHeight: 20, weight: 400 },
} as const satisfies Record<string, TypeToken>;

export type TypographyToken = keyof typeof typography;

/** 4pt grid. Key = Tailwind spacing step. */
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  xs: 4, // tooltips, kbd
  sm: 6, // badges, pills
  md: 10, // buttons, inputs
  lg: 14, // cards, tables
  xl: 20, // dialogs, sheets
  full: 999, // chips, status
} as const;

/** Elevation: light uses shadow, dark uses a lighter surface + deeper shadow. */
export const shadows = {
  dark: {
    e1: '0 1px 2px rgba(0,0,0,0.45)',
    e2: '0 8px 24px rgba(0,0,0,0.45)',
    e3: '0 24px 64px rgba(0,0,0,0.6)',
  },
  light: {
    e1: '0 1px 2px rgba(14,18,32,0.06), 0 1px 1px rgba(14,18,32,0.04)',
    e2: '0 8px 24px rgba(14,18,32,0.10)',
    e3: '0 24px 64px rgba(14,18,32,0.18)',
  },
} as const;

/**
 * Motion. Every token has a reduced-motion behaviour (see the `reduced` notes):
 * fast/base → 0 ms, slow → 120 ms opacity only, flash → 2 px underline instead of a fade,
 * spring → linear with no overshoot.
 */
export const motion = {
  duration: {
    instant: 0, // value text swaps
    fast: 120, // hover, press, focus ring
    base: 200, // switch, tab indicator, crosshair fade
    slow: 320, // dialogs, sheets, star pop
    flash: 400, // PriceFlash background fade
  },
  easing: {
    standard: [0.2, 0, 0, 1], // default for everything
    exit: [0.4, 0, 1, 1], // dismiss toast / banner
    spring: [0.34, 1.56, 0.64, 1], // star toggle overshoot
  },
  reduced: {
    slowOpacityMs: 120,
    flashUnderlinePx: 2,
  },
} as const;

export function cubicBezier(points: readonly [number, number, number, number]): string {
  return `cubic-bezier(${points.join(',')})`;
}

/** Layout specs from the developer notes. */
export const layout = {
  minTouchTarget: 44,
  mobile: { sideMargin: 20, listMargin: 16, searchHeight: 44, chipHeight: 36, tabBarHeight: 58 },
  stockRow: { minHeight: 64, avatar: 40, sparkline: { width: 52, height: 24, stroke: 1.6 } },
  detail: { chartHeight: 236, periodTabsHeight: 44 },
  web: { navHeight: 64, contentMax: 1240, listPaneMin: 380, listPaneMax: 440 },
  admin: { sidebar: 244, sidebarCollapsed: 76, topbar: 64, tableRow: 52, tableHeader: 40 },
} as const;

export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1440 } as const;
