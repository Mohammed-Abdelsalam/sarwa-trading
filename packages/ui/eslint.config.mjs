import base, { restrictedImports } from '@sarwa/eslint-config/base';
import { jestConfig } from '@sarwa/eslint-config/jest';
import react from '@sarwa/eslint-config/react';

export default [
  ...base,
  ...react,
  ...jestConfig({ dom: true }),
  {
    name: 'sarwa/ui/boundaries',
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports({
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
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
