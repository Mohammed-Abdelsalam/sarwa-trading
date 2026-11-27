import { appImportRules, designSystemSyntax } from '@sarwa/eslint-config/base';
import { jestConfig } from '@sarwa/eslint-config/jest';
import reactNative from '@sarwa/eslint-config/react-native';

const VIEW_ONLY =
  'Screens and components only render; data comes from a use-*-screen view-model or a core hook.';

export default [
  ...reactNative,
  ...jestConfig({ native: true }),
  { ignores: ['jest.setup.js', '.expo/**'] },
  ...appImportRules({
    customer: true,
    viewOnly: ['src/features/**/*.tsx', 'src/components/**/*.{ts,tsx}'],
    viewOnlyMessage: VIEW_ONLY,
  }),
  {
    name: 'sarwa/mobile/design-system',
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/ui/text.tsx'],
    rules: { 'no-restricted-syntax': designSystemSyntax },
  },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
