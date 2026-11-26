// @ts-check
/**
 * Jest preset for Node/logic code (contracts, core logic, server).
 * TypeScript is transpiled by SWC (Rust) — much faster than ts-jest, and it understands
 * decorators + emitDecoratorMetadata, which NestJS dependency injection needs.
 * Type-checking is a separate step (`pnpm typecheck`), so tests stay fast.
 *
 * Usage (jest.config.js):
 *   module.exports = { ...require('@sarwa/jest-config/node'), displayName: 'core' };
 */

/** @type {import('@swc/core').Options} */
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

/** @type {import('jest').Config} */
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
