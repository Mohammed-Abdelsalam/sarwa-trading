import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import globals from 'globals';
import importX from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

const APPS = ['@sarwa/server', '@sarwa/mobile', '@sarwa/web', '@sarwa/admin'];

export const boundaryPatterns = [
  {
    group: ['@sarwa/*/src', '@sarwa/*/src/**', '@sarwa/*/dist/**'],
    message: 'Import a package through its public entry point, never its internals.',
  },
  {
    group: ['**/apps/**', ...APPS],
    message: 'Apps are leaves of the dependency graph: nothing may import an app.',
  },
];

// Flat config replaces a rule's options instead of merging them, so every narrower rule keeps the boundaries.
export function restrictedImports({ patterns = [], paths = [] } = {}) {
  return ['error', { paths, patterns: [...boundaryPatterns, ...patterns] }];
}

// Components take colours and fonts from @sarwa/tokens, never as raw strings.
export const designSystemSyntax = [
  'error',
  {
    selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
    message: 'No hex colours in components: use a theme colour role from @sarwa/tokens.',
  },
  {
    selector: 'Literal[value=/^(Inter|Manrope|JetBrainsMono)_/]',
    message: 'No font-file names in components: use a Text variant/weight or fontFile().',
  },
];

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
      '@typescript-eslint/no-unused-vars': 'off',
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
    rules: { 'no-restricted-imports': restrictedImports() },
  },
  {
    name: 'sarwa/js-files',
    files: ['**/*.{js,cjs,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    name: 'sarwa/scripts',
    files: ['**/scripts/**/*.{js,mjs,cjs,ts}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  { name: 'sarwa/prettier', ...prettier },
];
