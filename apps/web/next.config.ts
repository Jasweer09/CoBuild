import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cobuild/ui', '@cobuild/shared'],
};

export default nextConfig;
