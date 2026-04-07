import type { NextConfig } from "next";



const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.254.102'],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn.grounds.ph",
      }
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
  trailingSlash: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    }
  }
};

export default nextConfig;