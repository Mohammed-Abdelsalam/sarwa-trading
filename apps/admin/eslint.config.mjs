import { designSystemSyntax, restrictedImports } from '@sarwa/eslint-config/base';
import { jestConfig } from '@sarwa/eslint-config/jest';
import next from '@sarwa/eslint-config/next';

const VIEW_ONLY =
  'Pages and components only render; data comes from a use-*-page view-model or a core hook.';

export default [
  ...next,
  ...jestConfig({ dom: true }),
  {
    name: 'sarwa/admin/view-only',
    files: ['src/features/**/*.tsx', 'src/components/**/*.tsx'],
    rules: {
      'no-restricted-imports': restrictedImports({
        paths: [
          { name: '@tanstack/react-query', message: VIEW_ONLY },
          { name: '@sarwa/core', importNames: ['useSarwa'], message: VIEW_ONLY },
        ],
      }),
    },
  },
  {
    name: 'sarwa/admin/design-system',
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': designSystemSyntax },
  },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
