import { vars } from 'nativewind';
import { useColorScheme, useWindowDimensions } from 'react-native';

import { type ThemeColors, type ThemeName, themes, themeVariables } from '@sarwa/tokens';

const themeVars = {
  light: vars(themeVariables('light')),
  dark: vars(themeVariables('dark')),
};

export function useThemeName(): ThemeName {
  return useColorScheme() === 'light' ? 'light' : 'dark';
}

export function useThemeVars() {
  return themeVars[useThemeName()];
}

export function useColors(): ThemeColors {
  return themes[useThemeName()];
}

// iOS accessibility sizes start around 1.6× (AX1); the canvas switches rows to two lines from there.
const LARGE_TEXT_SCALE = 1.6;

export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
