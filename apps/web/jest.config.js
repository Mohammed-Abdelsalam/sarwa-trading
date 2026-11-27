const preset = require('@sarwa/jest-config/jsdom');

module.exports = {
  ...preset,
  displayName: 'web',
  testPathIgnorePatterns: [...preset.testPathIgnorePatterns, '<rootDir>/e2e/'],
  setupFilesAfterEnv: [...preset.setupFilesAfterEnv, '<rootDir>/test/setup.tsx'],
};
