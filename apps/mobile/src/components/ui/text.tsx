import { type ComponentProps } from 'react';
import { Text as NativeText, Platform, type TextStyle } from 'react-native';

import {
  colorNames,
  componentTypography,
  type ComponentTypographyToken,
  type TypeToken,
  typography,
  type TypographyToken,
} from '@sarwa/tokens';

import { cx } from '../../lib/theme';

type FontFamily = TypeToken['family'];
type FontWeight = TypeToken['weight'];

// The only place font files are named: custom fonts ship one file per weight.
const FONT_FILES: Record<FontFamily, Partial<Record<FontWeight, string>>> = {
  sans: {
    400: 'Inter_400Regular',
    500: 'Inter_500Medium',
    600: 'Inter_600SemiBold',
    700: 'Inter_700Bold',
  },
  display: { 700: 'Manrope_700Bold', 800: 'Manrope_800ExtraBold' },
  mono: { 400: 'Inter_400Regular' },
};

// Android names an embedded font after its file, iOS after its PostScript name.
const IOS_NAMES: Record<string, string> = {
  Inter_400Regular: 'Inter-Regular',
  Inter_500Medium: 'Inter-Medium',
  Inter_600SemiBold: 'Inter-SemiBold',
  Inter_700Bold: 'Inter-Bold',
  Manrope_700Bold: 'Manrope-Bold',
  Manrope_800ExtraBold: 'Manrope-ExtraBold',
};

export function fontName(file: string): string {
  return Platform.OS === 'ios' ? (IOS_NAMES[file] ?? file) : file;
}

export function fontFile(family: FontFamily, weight: FontWeight): string {
  return fontName(FONT_FILES[family][weight] ?? FONT_FILES[family][400] ?? 'Inter_400Regular');
}

export type TextVariant = TypographyToken | ComponentTypographyToken;

const TOKENS: Record<TextVariant, TypeToken> = { ...typography, ...componentTypography };

const STYLES = Object.fromEntries(
  Object.entries(TOKENS).map(([name, t]) => {
    const style: TextStyle = {
      fontFamily: fontFile(t.family, t.weight),
      fontSize: t.size,
      lineHeight: t.lineHeight,
      ...(t.tracking !== undefined && { letterSpacing: t.tracking * t.size }),
      ...(t.uppercase && { textTransform: 'uppercase' }),
      ...(t.tabular && { fontVariant: ['tabular-nums'] }),
    };
    return [name, style];
  }),
) as Record<TextVariant, TextStyle>;

const COLOR_CLASSES = new Set([...colorNames().map((name) => `text-${name}`), 'text-white']);

// NativeWind doesn't resolve conflicting classes, so the default colour is only added when none is given.
export function hasTextColor(className = ''): boolean {
  return className.split(/\s+/).some((c) => COLOR_CLASSES.has(c.replace(/^dark:/, '')));
}

export interface TextProps extends ComponentProps<typeof NativeText> {
  variant?: TextVariant;
  weight?: FontWeight;
}

export function Text({ variant = 'body', weight, className, style, ...props }: TextProps) {
  return (
    <NativeText
      className={cx(!hasTextColor(className) && 'text-fg', className)}
      style={[
        STYLES[variant],
        weight !== undefined && { fontFamily: fontFile(TOKENS[variant].family, weight) },
        style,
      ]}
      maxFontSizeMultiplier={variant.startsWith('display') ? 1.3 : undefined}
      {...props}
    />
  );
}
