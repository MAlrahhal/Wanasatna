import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@wanasatna/shared'],
  turbopack: {
    // Monorepo root (apps/web → repo root). Use a plain relative path — import.meta.url
    // in next.config.ts breaks Next.js config compilation (CJS output loaded as ESM).
    root: '../..',
  },
};

export default nextConfig;
