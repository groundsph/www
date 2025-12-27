import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "uriwhfpoprbrcehboadj.supabase.co",
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/manage',
        permanent: true,
      },
      {
        source: '/admin/:path*',
        destination: '/manage/:path*',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;