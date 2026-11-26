import globals from 'globals';

import base from './base.js';

export default [
  ...base,
  {
    name: 'sarwa/nest',
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      // DI reads constructor types at runtime, so injected classes must be value imports.
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-console': 'off',
    },
  },
];
