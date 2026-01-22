import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable optimizePackageImports per react-best-practices
  experimental: {
    optimizePackageImports: ['@base-ui/react'],
  },
}

export default nextConfig
