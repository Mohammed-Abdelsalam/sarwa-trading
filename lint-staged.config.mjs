// Runs on `git commit` (via .husky/pre-commit) for staged files only — fast feedback.
// The ESLint flag makes ESLint 9 pick the eslint.config.js closest to each file,
// so every workspace is linted with its own config from the repo root.
export default {
  '*.{ts,tsx}': [
    'eslint --flag v10_config_lookup_from_file --fix --no-warn-ignored',
    'prettier --write',
  ],
  '*.{js,mjs,cjs,json,md,yml,yaml,css}': 'prettier --write',
};
