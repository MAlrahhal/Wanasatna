import { randomUUID } from 'node:crypto';

/**
 * Process-local identity for production isolation audits.
 * Safe to expose — no secrets.
 */
export const SERVER_INSTANCE_ID = randomUUID().slice(0, 8);

export const SERVER_BUILD_META = {
  service: 'server' as const,
  commitSha:
    process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
    process.env.COMMIT_SHA?.trim() ||
    process.env.SOURCE_VERSION?.trim() ||
    process.env.GIT_COMMIT?.trim() ||
    'unknown',
  buildTime:
    process.env.BUILD_TIME?.trim() ||
    process.env.RAILWAY_DEPLOYMENT_ID?.trim() ||
    'unknown',
  environment: process.env.NODE_ENV ?? 'development',
  instanceId: SERVER_INSTANCE_ID,
};
