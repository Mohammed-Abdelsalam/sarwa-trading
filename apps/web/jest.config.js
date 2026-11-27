const preset = require('@sarwa/jest-config/jsdom');

module.exports = {
  ...preset,
  displayName: 'web',
  coverageThreshold: { global: { statements: 65, branches: 52, functions: 56, lines: 66 } },
  setupFilesAfterEnv: [...preset.setupFilesAfterEnv, '<rootDir>/test/setup.tsx'],
};
