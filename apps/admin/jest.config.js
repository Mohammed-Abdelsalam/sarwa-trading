const preset = require('@sarwa/jest-config/jsdom');

module.exports = {
  ...preset,
  displayName: 'admin',
  setupFilesAfterEnv: [...preset.setupFilesAfterEnv, '<rootDir>/test/setup.tsx'],
};
