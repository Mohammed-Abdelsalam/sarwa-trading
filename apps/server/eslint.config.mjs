import { restrictedImports } from '@sarwa/eslint-config/base';
import jest from '@sarwa/eslint-config/jest';
import nest from '@sarwa/eslint-config/nest';

export default [
  ...nest,
  ...jest,
  { ignores: ['test/*.js'] },
  {
    name: 'sarwa/server/boundaries',
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        patterns: [
          {
            group: ['@sarwa/core', '@sarwa/ui', '@sarwa/tokens', 'react', 'react/*', 'react-*'],
            message: 'server only shares @sarwa/contracts with the clients.',
          },
        ],
      }),
    },
  },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
