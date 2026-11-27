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
  {
    name: 'sarwa/core/react-free-entries',
    files: ['src/server.ts', 'src/pure.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: ['react', 'zustand', 'socket.io-client', '@tanstack/react-query'].map((name) => ({
          name,
          message: 'server.ts and pure.ts are React-free entries: no React, hooks or live client.',
        })),
        patterns: [
          {
            // Query keys are plain data, so the server prefetch may share them.
            regex: '^\\./(provider|admin|hooks(/(?!keys$)|$))',
            message:
              'server.ts and pure.ts are React-free entries: no React, hooks or live client.',
          },
        ],
      }),
    },
  },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
