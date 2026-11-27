import base, { restrictedImports } from '@sarwa/eslint-config/base';
import jest from '@sarwa/eslint-config/jest';

export default [
  ...base,
  ...jest,
  {
    name: 'sarwa/i18n/boundaries',
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedImports({
        patterns: [
          {
            regex: '^(?!\.|@sarwa/domain$)',
            message: 'i18n is framework-free: only its own files and @sarwa/domain.',
          },
        ],
      }),
    },
  },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
