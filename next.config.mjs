/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel ignores `output: 'standalone'` and, on Next 16.3+, a hardcoded
  // standalone value crashes the Vercel build (ENOENT next-server.js.nft.json).
  // Keep standalone only for non-Vercel (Docker) deploys.
  output: process.env.VERCEL ? undefined : 'standalone',
  images: {
    // Allow the explicit quality={70} used in a couple of images instead of
    // being coerced to the Next 16 default of 75.
    qualities: [70, 75],
  },
  async headers() {
    return [
      {
        // Hazard/road/building archives are immutable for a given deployment.
        // A day of browser caching avoids re-downloading range chunks on every
        // visit without pinning a replaced archive for weeks.
        source: '/data/:path*.pmtiles',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${(process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
