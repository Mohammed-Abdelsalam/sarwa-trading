module.exports = {
  ...require('@sarwa/jest-config/jsdom'),
  displayName: 'ui',
  coverageThreshold: { global: { statements: 84, branches: 66, functions: 78, lines: 89 } },
};
