import { type TypeToken } from './scale';

export const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const;
export const BUTTON_SIZES = ['sm', 'md', 'lg'] as const;
export const ICON_BUTTON_SIZES = [32, 40, 44] as const;
export const INPUT_SIZES = ['md', 'lg'] as const;
export const BADGE_TONES = ['neutral', 'pos', 'neg', 'warn', 'info', 'brand', 'outline'] as const;
export const BANNER_TONES = ['info', 'warn', 'neutral', 'brand'] as const;
export const STATE_TONES = ['neutral', 'neg', 'brand'] as const;
export const CHANGE_PILL_SIZES = ['sm', 'md', 'lg'] as const;
export const PRICE_SIZES = ['display', 'display-web', 'lg', 'md', 'sm'] as const;
export const STAR_SIZES = [44, 36] as const;
export const AVATAR_SIZES = [24, 32, 40, 56] as const;

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];
export type ButtonSize = (typeof BUTTON_SIZES)[number];
export type IconButtonSize = (typeof ICON_BUTTON_SIZES)[number];
export type InputSize = (typeof INPUT_SIZES)[number];
export type BadgeTone = (typeof BADGE_TONES)[number];
export type BannerTone = (typeof BANNER_TONES)[number];
export type StateTone = (typeof STATE_TONES)[number];
export type ChangePillSize = (typeof CHANGE_PILL_SIZES)[number];
export type PriceSize = (typeof PRICE_SIZES)[number];
export type StarSize = (typeof STAR_SIZES)[number];
export type AvatarSize = (typeof AVATAR_SIZES)[number];

// Fixed sizes the canvas gives single components (off the 4 pt grid); both platforms use them as Tailwind keys.
export const componentSpacing = {
  'conn-gap': 7,
  'conn-start': 9,
  'seg-pad': 3,
  badge: 22,
  'pill-sm': 22,
  'pill-sm-min': 68,
  'pill-md': 26,
  'pill-md-min': 78,
  'seg-lg': 38,
  switch: 26,
  thumb: 22,
  art: 72,
  'price-col': 92,
  'price-col-wide': 96,
  'state-action': 220,
} as const;

export const componentRadius = {
  'control-sm': 8,
  'control-lg': 12,
  pill: 7,
  'pill-lg': 9,
  seg: 11,
  'avatar-lg': 16,
  mark: 9,
  dialog: 18,
  art: 22,
} as const;

export const componentContainer = { dialog: 440 } as const;

// Text styles the canvas sets on components rather than in the Foundations type scale.
export const componentTypography = {
  button: { family: 'sans', size: 14, lineHeight: 20, weight: 600 },
  'button-lg': { family: 'sans', size: 15, lineHeight: 20, weight: 600 },
  symbol: { family: 'sans', size: 15, lineHeight: 20, weight: 700 },
  tab: { family: 'sans', size: 11, lineHeight: 14, weight: 600 },
  'avatar-sm': { family: 'display', size: 13, lineHeight: 16, weight: 800 },
  avatar: { family: 'display', size: 16, lineHeight: 20, weight: 800 },
  'avatar-lg': { family: 'display', size: 22, lineHeight: 26, weight: 800 },
  logo: { family: 'display', size: 17, lineHeight: 20, weight: 800, tracking: -0.01 },
  kbd: { family: 'mono', size: 11, lineHeight: 12, weight: 500 },
  keypad: { family: 'sans', size: 24, lineHeight: 28, weight: 500, tabular: true },
  'display-equity': {
    family: 'sans',
    size: 34,
    lineHeight: 40,
    weight: 600,
    tracking: -0.02,
    tabular: true,
  },
} as const satisfies Record<string, TypeToken>;

export type ComponentTypographyToken = keyof typeof componentTypography;
