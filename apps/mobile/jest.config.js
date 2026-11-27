module.exports = {
  preset: 'jest-expo',
  displayName: 'mobile',
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**', '!src/**/*.d.ts'],
  coverageThreshold: { global: { statements: 53, branches: 49, functions: 55, lines: 54 } },
  setupFiles: ['<rootDir>/test/setup.ts'],
  // A suite's first render pays the cold jest-expo transform, which coverage slows further.
  testTimeout: 20_000,
  testMatch: ['<rootDir>/test/**/*.test.{ts,tsx}'],
  // lucide ships ESM (.mjs) for React Native; Jest needs its CommonJS build.
  moduleNameMapper: {
    '^lucide-react-native$':
      '<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sarwa/.*|nativewind|react-native-css-interop|lucide-react-native|@shopify/.*|zustand))',
  ],
};
