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

  tracking?: number;
  uppercase?: boolean;

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
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

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

export const motion = {
  duration: {
    instant: 0,
    fast: 120,
    base: 200,
    slow: 320,
    flash: 400,
  },
  easing: {
    standard: [0.2, 0, 0, 1],
    exit: [0.4, 0, 1, 1],
    spring: [0.34, 1.56, 0.64, 1],
  },
  reduced: {
    slowOpacityMs: 120,
    flashUnderlinePx: 2,
  },
} as const;

export function cubicBezier(points: readonly [number, number, number, number]): string {
  return `cubic-bezier(${points.join(',')})`;
}

export const layout = {
  minTouchTarget: 44,
  mobile: { sideMargin: 20, listMargin: 16, searchHeight: 44, chipHeight: 36, tabBarHeight: 58 },
  stockRow: {
    minHeight: 64,
    avatar: 40,
    sparkline: { width: 52, height: 24, stroke: 1.6 },
    sparklineWide: { width: 60, height: 26 },
  },
  detail: { chartHeight: 236, periodTabsHeight: 44, volumeHeight: 44 },
  web: { navHeight: 64, contentMax: 1240, listPaneMin: 380, listPaneMax: 440 },
  admin: { sidebar: 244, sidebarCollapsed: 76, topbar: 64, tableRow: 52, tableHeader: 40 },
} as const;

export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1440 } as const;
