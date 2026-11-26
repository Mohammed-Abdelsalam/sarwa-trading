// SWC transpiles TS and decorators fast; type-checking runs separately in `typecheck`.
const swcOptions = {
  jsc: {
    target: 'es2022',
    parser: { syntax: 'typescript', tsx: true, decorators: true },
    transform: {
      legacyDecorator: true,
      decoratorMetadata: true,
      react: { runtime: 'automatic' },
    },
    keepClassNames: true,
  },
  module: { type: 'commonjs' },
  sourceMaps: 'inline',
};

module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', swcOptions],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}', '<rootDir>/test/**/*.{test,spec}.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/test-utils/**',
  ],
  coverageReporters: ['text-summary', 'lcov'],
};
