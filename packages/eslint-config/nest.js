// @ts-check
/** NestJS server: base + node globals + the few relaxations decorators/DI need. */
import globals from 'globals';

import base from './base.js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  {
    name: 'sarwa/nest',
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Nest modules are empty classes decorated with @Module()
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      // DI reads constructor param types at runtime (emitDecoratorMetadata), so injected
      // classes must be value imports, not `import type`.
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-console': 'off',
    },
  },
];
