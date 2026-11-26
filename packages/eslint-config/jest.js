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

export function jestConfig({ dom = false, native = false } = {}) {
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
