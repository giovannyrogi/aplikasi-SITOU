/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // A 10 MiB PDF plus multipart boundaries must reach the bounded upload parser intact.
  experimental: {
    proxyClientMaxBodySize: 11 * 1024 * 1024,
    // Next.js #100251: persisted dev cache can trigger an HMR reload loop after restart.
    turbopackFileSystemCacheForDev: false,
  },
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
        : []),
    ];
    return [
      { source: "/:path*", headers: common },
      {
        source: "/api/:path*",
        headers: [...common, { key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
