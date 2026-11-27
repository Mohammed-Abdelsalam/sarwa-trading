const preset = require('@sarwa/jest-config/jsdom');

module.exports = {
  ...preset,
  displayName: 'web',
  setupFilesAfterEnv: [...preset.setupFilesAfterEnv, '<rootDir>/test/setup.tsx'],
};
