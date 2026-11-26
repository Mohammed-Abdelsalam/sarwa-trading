import { type ComponentProps } from 'react';
import { Text as NativeText, type TextStyle } from 'react-native';

import { colorNames, typography, type TypographyToken } from '@sarwa/tokens';

import { cx } from '../../lib/theme';

const FONT_FILES: Record<'sans' | 'display' | 'mono', Partial<Record<number, string>>> = {
  sans: {
    400: 'Inter_400Regular',
    500: 'Inter_500Medium',
    600: 'Inter_600SemiBold',
    700: 'Inter_700Bold',
  },
  display: { 700: 'Manrope_700Bold', 800: 'Manrope_800ExtraBold' },
  mono: { 400: 'Inter_400Regular' },
};

// Custom fonts are one file per weight, so the weight picks the font file instead of fontWeight.
const STYLES = Object.fromEntries(
  Object.entries(typography).map(([name, t]) => {
    const style: TextStyle = {
      fontFamily: FONT_FILES[t.family][t.weight],
      fontSize: t.size,
      lineHeight: t.lineHeight,
      ...('tracking' in t && { letterSpacing: t.tracking * t.size }),
      ...('uppercase' in t && { textTransform: 'uppercase' }),
      ...('tabular' in t && { fontVariant: ['tabular-nums'] }),
    };
    return [name, style];
  }),
) as Record<TypographyToken, TextStyle>;

const COLOR_CLASSES = new Set([...colorNames().map((name) => `text-${name}`), 'text-white']);

// NativeWind doesn't resolve conflicting classes, so the default colour is only added when none is given.
export function hasTextColor(className = ''): boolean {
  return className.split(/\s+/).some((c) => COLOR_CLASSES.has(c.replace(/^dark:/, '')));
}

export interface TextProps extends ComponentProps<typeof NativeText> {
  variant?: TypographyToken;
}

export function Text({ variant = 'body', className, style, ...props }: TextProps) {
  return (
    <NativeText
      className={cx(!hasTextColor(className) && 'text-fg', className)}
      style={[STYLES[variant], style]}
      maxFontSizeMultiplier={variant.startsWith('display') ? 1.3 : undefined}
      {...props}
    />
  );
}
