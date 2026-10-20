import { resolveDatabaseUrl } from './database-url.js';
import { isExperimentalGamesCapabilityEnabled } from './experimental-games.js';

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: resolveDatabaseUrl(),
  /** When true, phase timers use 1s durations for automated tests only. */
  testMode: process.env.WANASATNA_TEST_MODE === '1',
  authSessionTtlMs: Number(process.env.AUTH_SESSION_TTL_MS ?? 30 * 24 * 60 * 60 * 1000),
  adminTotpEncryptionKey: process.env.ADMIN_TOTP_ENCRYPTION_KEY,
  /** Fail-closed server gate for owner-only experimental game testing. */
  experimentalGamesEnabled: isExperimentalGamesCapabilityEnabled(
    nodeEnv,
    process.env.RAILWAY_ENVIRONMENT_NAME,
    process.env.EXPERIMENTAL_GAMES_TEST_MODE,
    process.env.EXPERIMENTAL_GAMES_PRODUCTION_PLAYTEST,
  ),
};
