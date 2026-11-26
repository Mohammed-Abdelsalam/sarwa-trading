/** @type {import('jest').Config} */
module.exports = {
  ...require('@sarwa/jest-config/node'),
  displayName: 'server',
  // e2e tests boot the real app against a throwaway SQLite database (see test/setup.ts)
  globalSetup: '<rootDir>/test/global-setup.js',
  setupFiles: ['<rootDir>/test/setup-env.js'],
};
