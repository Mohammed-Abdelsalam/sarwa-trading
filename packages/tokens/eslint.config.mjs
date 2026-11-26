import base from '@sarwa/eslint-config/base';
import jest from '@sarwa/eslint-config/jest';

export default [
  ...base,
  ...jest,
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
