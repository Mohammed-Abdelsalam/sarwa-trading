import { vars } from 'nativewind';
import { useColorScheme } from 'react-native';

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

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
