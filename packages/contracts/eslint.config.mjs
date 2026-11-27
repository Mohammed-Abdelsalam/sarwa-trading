import base, { restrictedImports } from '@sarwa/eslint-config/base';
import jest from '@sarwa/eslint-config/jest';

export default [
  ...base,
  ...jest,
  {
    name: 'sarwa/contracts/boundaries',
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        patterns: [
          {
            group: [
              'react',
              'react-*',
              'react/*',
              '@sarwa/*',
              '!@sarwa/domain',
              'socket.io*',
              '@tanstack/*',
            ],
            message: 'contracts sits just above @sarwa/domain: only zod, domain and its own files.',
          },
        ],
      }),
    },
  },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
