import { type NextConfig } from 'next';

import { securityHeaders } from '@sarwa/ui/next-config';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
  poweredByHeader: false,
  transpilePackages: ['@sarwa/core', '@sarwa/ui'],
  // Socket.IO lives at "/socket.io/"; Next's trailing-slash redirect would send it to "/socket.io".
  skipTrailingSlashRedirect: true,
  // An internal tool: never indexed, even for files that carry no metadata.
  headers: () =>
    Promise.resolve([
      {
        source: '/:path*',
        headers: [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ]),
  // Same-origin API: the httpOnly, SameSite=strict session cookie only works without CORS.
  rewrites: () =>
    Promise.resolve([
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/socket.io/', destination: `${API_URL}/socket.io/` },
    ]),
};

export default nextConfig;
