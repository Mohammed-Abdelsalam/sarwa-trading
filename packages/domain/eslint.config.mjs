import base, { restrictedImports } from '@sarwa/eslint-config/base';
import jest from '@sarwa/eslint-config/jest';

export default [
  ...base,
  ...jest,
  {
    name: 'sarwa/domain/boundaries',
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        patterns: [
          {
            regex: '^[^.]',
            message: 'domain is pure TypeScript at the bottom of the graph: no packages at all.',
          },
        ],
      }),
    },
  },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
