module.exports = {
  ...require('@sarwa/jest-config/jsdom'),
  displayName: 'core',
  coverageThreshold: {
    global: { statements: 80, lines: 80, functions: 80, branches: 75 },
  },
};
