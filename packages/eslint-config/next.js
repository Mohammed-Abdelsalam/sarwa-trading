// @ts-check
/** Next.js apps (web + admin): base + react + a11y + Next core-web-vitals. */
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

import base from './base.js';
import react from './react.js';

const FILES = ['**/*.{ts,tsx,jsx}'];

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  ...react,
  { ...jsxA11y.flatConfigs.recommended, name: 'sarwa/a11y', files: FILES },
  { ...nextPlugin.configs['core-web-vitals'], name: 'sarwa/next', files: FILES },
  {
    name: 'sarwa/next/globals',
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
];
