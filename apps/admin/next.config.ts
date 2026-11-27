import { type NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
  transpilePackages: ['@sarwa/core', '@sarwa/ui'],
  // Same-origin API: the httpOnly, SameSite=strict session cookie only works without CORS.
  rewrites: () =>
    Promise.resolve([
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${API_URL}/socket.io/:path*` },
    ]),
};

export default nextConfig;
