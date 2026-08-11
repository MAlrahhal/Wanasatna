import { NextResponse } from 'next/server';

/**
 * Safe web build identity for production isolation audits.
 * No secrets. NEXT_PUBLIC_* values are already public in the browser bundle.
 */
export function GET() {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL?.trim().replace(/\/$/, '') || 'unset';

  return NextResponse.json({
    service: 'web',
    commitSha:
      process.env.NEXT_PUBLIC_COMMIT_SHA?.trim() ||
      process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
      process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
      'unknown',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME?.trim() || 'unknown',
    environment: process.env.NODE_ENV ?? 'development',
    serverUrl,
  });
}
