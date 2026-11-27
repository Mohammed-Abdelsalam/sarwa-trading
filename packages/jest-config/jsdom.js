const nodePreset = require('./node.js');

module.exports = {
  ...nodePreset,
  testEnvironment: 'jsdom',
  testTimeout: 15000,
  maxWorkers: '50%',
  setupFilesAfterEnv: [require.resolve('./setup-dom.js')],
  moduleNameMapper: {
    '\\.(css|less|scss)$': require.resolve('./style-mock.js'),
  },
};
