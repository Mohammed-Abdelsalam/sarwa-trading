import expoFlat from 'eslint-config-expo/flat.js';
import globals from 'globals';

import base from './base.js';
import react from './react.js';

// Only the expo/* rules: the other entries duplicate plugins already registered in base.
const expoOnly = expoFlat
  .filter((cfg) => cfg.plugins !== undefined && 'expo' in cfg.plugins)
  .map((cfg) => ({
    name: 'sarwa/expo',
    plugins: { expo: cfg.plugins?.expo },
    rules: Object.fromEntries(
      Object.entries(cfg.rules ?? {}).filter(([rule]) => rule.startsWith('expo/')),
    ),
  }));

export default [
  ...base,
  ...react,
  ...expoOnly,
  {
    name: 'sarwa/react-native/globals',
    languageOptions: { globals: { ...globals.browser, __DEV__: 'readonly' } },
  },
];
