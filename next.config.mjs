const dev = process.env.NODE_ENV !== 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A static export (out/): netra serves it, or any static server with the detail-page fallback
  // (/anomalies/12 -> /anomalies/0.html, see docs/architecture.md).
  output: dev ? undefined : 'export',
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  // Development: proxy the API so the browser talks to one origin.
  ...(dev && process.env.NETRA_API_URL
    ? { rewrites: async () => [{ source: '/api/:path*', destination: `${process.env.NETRA_API_URL}/api/:path*` }] }
    : {}),
};

export default nextConfig;
