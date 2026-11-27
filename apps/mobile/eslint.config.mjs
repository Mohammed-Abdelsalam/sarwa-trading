import { designSystemSyntax, restrictedImports } from '@sarwa/eslint-config/base';
import { jestConfig } from '@sarwa/eslint-config/jest';
import reactNative from '@sarwa/eslint-config/react-native';

const VIEW_ONLY =
  'Screens and components only render; data comes from a use-*-screen view-model or a core hook.';

export default [
  ...reactNative,
  ...jestConfig({ native: true }),
  { ignores: ['jest.setup.js', '.expo/**'] },
  {
    name: 'sarwa/mobile/view-only',
    files: ['src/features/**/*.tsx', 'src/components/**/*.{ts,tsx}'],
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
    name: 'sarwa/mobile/design-system',
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/ui/text.tsx'],
    rules: { 'no-restricted-syntax': designSystemSyntax },
  },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
