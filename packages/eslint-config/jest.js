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
// Playwright specs share the .spec name but run in a real browser, not Jest.
const NOT_JEST = ['**/e2e/**'];

export function jestConfig({ dom = false, native = false } = {}) {
  const configs = [
    {
      ...jestPlugin.configs['flat/recommended'],
      name: 'sarwa/jest',
      files: TEST_FILES,
      ignores: NOT_JEST,
    },
    {
      ...jestPlugin.configs['flat/style'],
      name: 'sarwa/jest/style',
      files: TEST_FILES,
      ignores: NOT_JEST,
    },
    {
      name: 'sarwa/jest/rules',
      files: TEST_FILES,
      ignores: NOT_JEST,
      languageOptions: { globals: { ...globals.jest } },
      rules: {
        'jest/consistent-test-it': ['error', { fn: 'it' }],
        'jest/no-disabled-tests': 'error',
        'jest/no-focused-tests': 'error',
        'jest/prefer-hooks-on-top': 'error',
        'jest/expect-expect': [
          'error',
          { assertFunctionNames: ['expect', 'http.**.expect', 'request.**.expect'] },
        ],
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
      ignores: NOT_JEST,
    });
  }
  if (native) {
    configs.push({
      name: 'sarwa/testing-library/native',
      files: TEST_FILES,
      ignores: NOT_JEST,
      // React Native Testing Library 14 made render/fireEvent async; this rule predates that.
      rules: { 'testing-library/no-await-sync-events': 'off' },
    });
  }
  if (dom) {
    configs.push({
      ...jestDom.configs['flat/recommended'],
      name: 'sarwa/jest-dom',
      files: TEST_FILES,
      ignores: NOT_JEST,
    });
  }
  return configs;
}

export default jestConfig();
