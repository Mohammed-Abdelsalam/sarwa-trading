// @ts-check
/**
 * Jest preset for React DOM code (ui package, hooks that touch the DOM).
 * Same SWC transform as the node preset + jsdom + jest-dom matchers.
 * (The Next.js apps use `next/jest` and the mobile app uses `jest-expo` instead.)
 */
const nodePreset = require('./node.js');

/** @type {import('jest').Config} */
module.exports = {
  ...nodePreset,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [require.resolve('./setup-dom.js')],
  moduleNameMapper: {
    '\\.(css|less|scss)$': require.resolve('./style-mock.js'),
  },
};
