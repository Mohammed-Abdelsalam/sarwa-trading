module.exports = {
  ...require('@sarwa/jest-config/node'),
  displayName: 'domain',
  coverageThreshold: {
    global: { statements: 100, lines: 100, functions: 100, branches: 100 },
  },
};
