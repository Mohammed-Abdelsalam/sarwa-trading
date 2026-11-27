module.exports = {
  ...require('@sarwa/jest-config/node'),
  displayName: 'i18n',
  coverageThreshold: {
    global: { statements: 95, lines: 95, functions: 95, branches: 95 },
  },
};
