module.exports = {
  preset: 'jest-expo',
  displayName: 'mobile',
  coverageThreshold: { global: { statements: 55, branches: 46, functions: 58, lines: 57 } },
  setupFiles: ['<rootDir>/test/setup.ts'],
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
