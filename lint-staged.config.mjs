// The flag makes ESLint 9 use the eslint.config closest to each staged file.
export default {
  '*.{ts,tsx}': [
    'eslint --flag v10_config_lookup_from_file --fix --no-warn-ignored',
    'prettier --write',
  ],
  '*.{js,mjs,cjs,json,md,yml,yaml,css}': 'prettier --write',
};
