module.exports = {
  ...require('@sarwa/jest-config/node'),
  displayName: 'server',
  globalSetup: '<rootDir>/test/global-setup.js',
  setupFiles: ['<rootDir>/test/setup-env.js'],
  // The e2e suites boot the app on a real database and sockets; 5 s is too tight when turbo
  // runs every workspace's tests at once.
  testTimeout: 30_000,
};
