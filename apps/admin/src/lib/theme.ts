import { useTheme as useStoredTheme } from '@sarwa/ui';

import { THEME_KEY } from './theme-script';

export const useTheme = () => useStoredTheme(THEME_KEY);
