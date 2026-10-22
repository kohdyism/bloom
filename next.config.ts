import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Microphone is allowed for this origin only (optional speech-to-text); camera
  // for photographing physical work. Nothing else.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  // Every Bloom screen is per-user, authenticated and realtime, so the static
  // shell that Cache Components optimises for buys nothing here. We use the
  // classic dynamic rendering model instead.
  cacheComponents: false,
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
