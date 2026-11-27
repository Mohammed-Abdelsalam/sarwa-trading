import { type NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
  transpilePackages: ['@sarwa/core', '@sarwa/ui'],
  // Socket.IO lives at "/socket.io/"; Next's trailing-slash redirect would send it to "/socket.io".
  skipTrailingSlashRedirect: true,
  // Same-origin API: the httpOnly, SameSite=strict session cookie only works without CORS.
  rewrites: () =>
    Promise.resolve([
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/socket.io/', destination: `${API_URL}/socket.io/` },
    ]),
};

export default nextConfig;
