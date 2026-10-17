import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // E2E runs its own dev server beside yours; a separate build dir avoids Next's one-server lock.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * On Vercel the frontend and API are separate projects on different *.vercel.app sites, and
   * browsers would treat the session cookie as third-party. With BACKEND_URL set, the browser
   * talks only to this origin (NEXT_PUBLIC_API_BASE_URL=/api/v1) and Next proxies to the API,
   * so the cookie is first-party and SameSite=Lax keeps working.
   */
  async rewrites() {
    const backend = process.env.BACKEND_URL?.replace(/\/$/, '');
    return backend ? [{ source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` }] : [];
  },
  async redirects() {
    return [{ source: '/profile', destination: '/settings', permanent: true }];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
        ],
      },
    ];
  },
};
export default nextConfig;
