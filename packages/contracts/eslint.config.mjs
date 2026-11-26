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
            group: ['react', 'react-*', 'react/*', '@sarwa/*', 'socket.io*', '@tanstack/*'],
            message: 'contracts is the bottom of the graph: only zod and its own files.',
          },
        ],
      }),
    },
  },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
