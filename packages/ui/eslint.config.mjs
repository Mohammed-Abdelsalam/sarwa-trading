import base, { designSystemSyntax, restrictedImports } from '@sarwa/eslint-config/base';
import { jestConfig } from '@sarwa/eslint-config/jest';
import react from '@sarwa/eslint-config/react';

const UI_ONLY =
  'ui is presentational: take data through props; helpers and types come from @sarwa/core/pure.';

export default [
  ...base,
  ...react,
  ...jestConfig({ dom: true }),
  {
    name: 'sarwa/ui/boundaries',
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: [
          { name: '@tanstack/react-query', message: UI_ONLY },
          { name: '@sarwa/core', message: UI_ONLY },
          { name: '@sarwa/core/admin', message: UI_ONLY },
        ],
        patterns: [
          {
            group: [
              'react-native',
              'react-native-*',
              'expo',
              'expo-*',
              '@expo/*',
              'next',
              'next/*',
            ],
            message: 'ui is plain React DOM for web and admin: no React Native or Next.js imports.',
          },
        ],
      }),
    },
  },
  {
    name: 'sarwa/ui/design-system',
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': designSystemSyntax },
  },
  {
    name: 'sarwa/ui/next-config',
    files: ['next-config.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { process: 'readonly', URL: 'readonly' } },
  },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
