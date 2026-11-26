const nodePreset = require('./node.js');

module.exports = {
  ...nodePreset,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [require.resolve('./setup-dom.js')],
  moduleNameMapper: {
    '\\.(css|less|scss)$': require.resolve('./style-mock.js'),
  },
};
