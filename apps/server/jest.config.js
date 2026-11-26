module.exports = {
  ...require('@sarwa/jest-config/node'),
  displayName: 'server',
  globalSetup: '<rootDir>/test/global-setup.js',
  setupFiles: ['<rootDir>/test/setup-env.js'],
};
