import jest from '@sarwa/eslint-config/jest';
import nest from '@sarwa/eslint-config/nest';

export default [
  ...nest,
  ...jest,
  { ignores: ['test/*.js'] },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
