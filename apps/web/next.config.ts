import { type NextConfig } from 'next';

import { securityHeaders } from '@sarwa/ui/next-config';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
  poweredByHeader: false,
  // core and ui ship TypeScript source, so Next compiles them like app code.
  transpilePackages: ['@sarwa/core', '@sarwa/ui'],
  // Socket.IO lives at "/socket.io/"; Next's trailing-slash redirect would send it to "/socket.io".
  skipTrailingSlashRedirect: true,
  headers: () => Promise.resolve([{ source: '/:path*', headers: securityHeaders }]),
  // Same-origin API: the httpOnly session cookies and the CSRF cookie need no CORS.
  rewrites: () =>
    Promise.resolve([
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/socket.io/', destination: `${API_URL}/socket.io/` },
    ]),
};

export default nextConfig;
