import { type NextConfig } from 'next';

import { securityHeaders } from '@sarwa/ui/next-config';

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
  poweredByHeader: false,
  // core and ui ship TypeScript source, so Next compiles them like app code.
  transpilePackages: ['@sarwa/core', '@sarwa/ui'],
  headers: () => Promise.resolve([{ source: '/:path*', headers: securityHeaders }]),
};

export default nextConfig;
