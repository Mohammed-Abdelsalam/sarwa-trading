// @ts-check
/**
 * Expo / React Native app: base + react + the Expo plugin rules only.
 * We take just the `expo` plugin entries from eslint-config-expo, because its other entries
 * register a second copy of the import/react/TS plugins and would clash with our base.
 */
import expoFlat from 'eslint-config-expo/flat.js';
import globals from 'globals';

import base from './base.js';
import react from './react.js';

/** @type {import('eslint').Linter.Config[]} */
const expoOnly = /** @type {import('eslint').Linter.Config[]} */ (expoFlat)
  .filter((cfg) => cfg.plugins !== undefined && 'expo' in cfg.plugins)
  .map((cfg) => ({
    name: 'sarwa/expo',
    plugins: { expo: /** @type {import('eslint').ESLint.Plugin} */ (cfg.plugins?.expo) },
    // keep only the expo/* rules; the same objects also carry import/* rules for a plugin we don't load
    rules: Object.fromEntries(
      Object.entries(cfg.rules ?? {}).filter(([rule]) => rule.startsWith('expo/')),
    ),
  }));

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  ...react,
  ...expoOnly,
  {
    name: 'sarwa/react-native/globals',
    languageOptions: { globals: { ...globals.browser, __DEV__: 'readonly' } },
  },
];
