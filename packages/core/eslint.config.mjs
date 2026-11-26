import base, { restrictedImports } from '@sarwa/eslint-config/base';
import { jestConfig } from '@sarwa/eslint-config/jest';
import react from '@sarwa/eslint-config/react';

export default [
  ...base,
  ...react,
  ...jestConfig({ dom: true }),
  {
    name: 'sarwa/core/boundaries',
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
              'react-dom',
              'react-dom/*',
              'next',
              'next/*',
              '@sarwa/ui',
            ],
            message: 'core is shared by mobile, web and admin: keep it platform-free.',
          },
        ],
      }),
    },
  },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
