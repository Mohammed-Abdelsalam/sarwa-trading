import { jestConfig } from '@sarwa/eslint-config/jest';
import reactNative from '@sarwa/eslint-config/react-native';

export default [
  ...reactNative,
  ...jestConfig({ native: true }),
  { ignores: ['jest.setup.js', '.expo/**'] },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
