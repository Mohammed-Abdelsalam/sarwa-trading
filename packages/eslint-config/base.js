// @ts-check
/**
 * Base config for every TypeScript workspace.
 *  - typescript-eslint strict + stylistic, type-aware (projectService)
 *  - import hygiene (order, cycles, duplicates) via import-x
 *  - architectural boundaries: packages never import apps, apps never import each other,
 *    nobody deep-imports another package's internals (only its public entry points).
 *
 * Usage (in a workspace eslint.config.js):
 *   import base from '@sarwa/eslint-config/base';
 *   export default [...base, { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } }];
 */
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

const APPS = ['@sarwa/server', '@sarwa/mobile', '@sarwa/web', '@sarwa/admin'];

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    name: 'sarwa/ignores',
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/next-env.d.ts',
      '**/*.config.{js,cjs,mjs,ts}',
      '**/babel.config.js',
      '**/metro.config.js',
      '**/nativewind-env.d.ts',
      '**/expo-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    name: 'sarwa/typescript',
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      '@typescript-eslint/no-unused-vars': 'off', // handled by unused-imports below
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'object-shorthand': 'error',
    },
  },
  {
    name: 'sarwa/imports',
    plugins: { 'import-x': importX, 'unused-imports': unusedImports },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
      'import-x/no-duplicates': ['error', { 'prefer-inline': true }],
      'import-x/no-cycle': ['error', { maxDepth: 10, ignoreExternal: true }],
      'import-x/no-self-import': 'error',
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
          pathGroups: [{ pattern: '@sarwa/**', group: 'internal', position: 'before' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        { vars: 'all', args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    name: 'sarwa/boundaries',
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@sarwa/*/src', '@sarwa/*/src/**', '@sarwa/*/dist/**'],
              message: 'Import a package through its public entry point, never its internals.',
            },
            {
              group: ['**/apps/**', ...APPS],
              message: 'Apps are leaves of the dependency graph: nothing may import an app.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'sarwa/js-files',
    files: ['**/*.{js,cjs,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  { name: 'sarwa/prettier', ...prettier },
];
