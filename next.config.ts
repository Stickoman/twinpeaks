import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Content-Security-Policy
// ---------------------------------------------------------------------------

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co https://maps.gstatic.com https://maps.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' data: https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const contentSecurityPolicy = cspDirectives.join("; ");

// ---------------------------------------------------------------------------
// Next.js Config
// ---------------------------------------------------------------------------

const nextConfig: NextConfig = {
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
