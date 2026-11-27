import { type NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
  // core and ui ship TypeScript source, so Next compiles them like app code.
  transpilePackages: ['@sarwa/core', '@sarwa/ui'],
};

export default nextConfig;
