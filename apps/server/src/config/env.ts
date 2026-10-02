import { resolveDatabaseUrl } from './database-url.js';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: resolveDatabaseUrl(),
  /** When true, phase timers use 1s durations for automated tests only. */
  testMode: process.env.WANASATNA_TEST_MODE === '1',
  authSessionTtlMs: Number(process.env.AUTH_SESSION_TTL_MS ?? 30 * 24 * 60 * 60 * 1000),
  adminTotpEncryptionKey: process.env.ADMIN_TOTP_ENCRYPTION_KEY,
  purchaserOtpSecret: process.env.PURCHASER_OTP_SECRET,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
};
