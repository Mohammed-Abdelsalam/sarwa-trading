const preset = require('@sarwa/jest-config/jsdom');

module.exports = {
  ...preset,
  displayName: 'admin',
  coverageThreshold: { global: { statements: 60, branches: 49, functions: 44, lines: 62 } },
  setupFilesAfterEnv: [...preset.setupFilesAfterEnv, '<rootDir>/test/setup.tsx'],
};
