// @ts-check
/**
 * React rules shared by web, admin, ui and mobile.
 * react-hooks "recommended-latest" also ships the React Compiler rules (purity, refs,
 * immutability…), which keep components compiler-friendly.
 */
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

const FILES = ['**/*.{ts,tsx,jsx}'];

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ...react.configs.flat.recommended,
    name: 'sarwa/react',
    files: FILES,
    settings: { react: { version: 'detect' } },
  },
  { ...react.configs.flat['jsx-runtime'], name: 'sarwa/react/jsx-runtime', files: FILES },
  { ...reactHooks.configs.flat['recommended-latest'], name: 'sarwa/react-hooks', files: FILES },
  {
    name: 'sarwa/react/rules',
    files: FILES,
    rules: {
      'react/prop-types': 'off', // TypeScript covers this
      'react/jsx-no-useless-fragment': 'error',
      'react/self-closing-comp': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/no-array-index-key': 'warn',
      'react/jsx-key': ['error', { checkFragmentShorthand: true }],
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
