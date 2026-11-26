// @ts-check
/**
 * Rules for test files only.
 *   jestConfig()                 → node/logic tests
 *   jestConfig({ dom: true })    → + Testing Library (React DOM) + jest-dom
 *   jestConfig({ native: true }) → + Testing Library rules for React Native Testing Library
 */
import jestPlugin from 'eslint-plugin-jest';
import jestDom from 'eslint-plugin-jest-dom';
import testingLibrary from 'eslint-plugin-testing-library';
import globals from 'globals';

const TEST_FILES = [
  '**/*.{test,spec}.{ts,tsx}',
  '**/test/**/*.{ts,tsx}',
  '**/__tests__/**/*.{ts,tsx}',
  '**/test-utils/**/*.{ts,tsx}',
];

/**
 * @param {{ dom?: boolean; native?: boolean }} [options]
 * @returns {import('eslint').Linter.Config[]}
 */
export function jestConfig({ dom = false, native = false } = {}) {
  /** @type {import('eslint').Linter.Config[]} */
  const configs = [
    { ...jestPlugin.configs['flat/recommended'], name: 'sarwa/jest', files: TEST_FILES },
    { ...jestPlugin.configs['flat/style'], name: 'sarwa/jest/style', files: TEST_FILES },
    {
      name: 'sarwa/jest/rules',
      files: TEST_FILES,
      languageOptions: { globals: { ...globals.jest } },
      rules: {
        'jest/consistent-test-it': ['error', { fn: 'it' }],
        'jest/no-disabled-tests': 'error',
        'jest/no-focused-tests': 'error',
        'jest/prefer-hooks-on-top': 'error',
        // mocks and fixtures legitimately need looser typing
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-empty-function': 'off',
      },
    },
  ];
  if (dom || native) {
    configs.push({
      ...testingLibrary.configs['flat/react'],
      name: 'sarwa/testing-library',
      files: TEST_FILES,
    });
  }
  if (dom) {
    configs.push({
      ...jestDom.configs['flat/recommended'],
      name: 'sarwa/jest-dom',
      files: TEST_FILES,
    });
  }
  return configs;
}

export default jestConfig();
