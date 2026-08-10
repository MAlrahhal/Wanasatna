import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, '../..');

const nextConfig: NextConfig = {
  transpilePackages: ['@wanasatna/shared'],
  // Playwright / some tools hit 127.0.0.1 while the app is served on localhost.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
