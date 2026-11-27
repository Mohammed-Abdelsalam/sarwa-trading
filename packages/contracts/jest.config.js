module.exports = {
  ...require('@sarwa/jest-config/node'),
  displayName: 'contracts',
  coverageThreshold: { global: { statements: 95, branches: 95, functions: 95, lines: 95 } },
};
