import base from '@sarwa/eslint-config/base';
import { jestConfig } from '@sarwa/eslint-config/jest';
import react from '@sarwa/eslint-config/react';

export default [
  ...base,
  ...react,
  ...jestConfig({ dom: true }),
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
