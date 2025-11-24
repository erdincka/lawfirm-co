import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // For production Docker builds
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.BACKEND_URL || 'http://backend:8000/:path*',
      },
    ]
  },
  reactCompiler: true,
};

export default nextConfig;
