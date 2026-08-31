import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, '../..');

export const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
] as const;

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
  async headers() {
    return [{ source: '/:path*', headers: [...SECURITY_HEADERS] }];
  },
};

export default nextConfig;
