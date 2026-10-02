import { randomBytes } from 'node:crypto';
import { UserRole } from '@prisma/client';
import type {
  AuthActionResponse,
  AuthSessionData,
  PurchaserOtpRequestData,
} from '@wanasatna/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from './password.js';
import { issueAuthSession, type IssuedAuthSession } from './issue-auth-session.js';
import {
  generatePurchaserOtpCode,
  hashPurchaserOtpCode,
  isPurchaserOtpSecretConfigured,
  purchaserOtpHashMatches,
} from './purchaser-otp.crypto.js';
import {
  createResendPurchaserOtpEmailTransport,
  type PurchaserOtpEmailTransport,
} from './purchaser-otp.email.js';
import { generateSessionToken } from './session-token.js';

export const PURCHASER_OTP_TTL_MS = 10 * 60 * 1000;
export const PURCHASER_OTP_MAX_ATTEMPTS = 5;
export const PURCHASER_OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const INVALID_OTP_MESSAGE = 'تعذر التحقق من الرمز.';
const DELIVERY_UNAVAILABLE_MESSAGE = 'تعذر إرسال الرمز الآن. حاول مرة أخرى لاحقًا.';
const DEFAULT_PURCHASER_DISPLAY_NAME = 'مستخدم وناستنا';

type AuthFailure = Extract<AuthActionResponse<never>, { success: false }>;
type PurchaserOtpVerificationResult =
  ({ success: true; data: AuthSessionData } & { session: IssuedAuthSession }) | AuthFailure;

type PurchaserOtpServiceOptions = {
  db?: typeof prisma;
  emailTransport: PurchaserOtpEmailTransport;
  otpSecret: string | undefined;
  codeGenerator?: () => string;
  challengeIdGenerator?: () => string;
};

export type PurchaserOtpService = {
  requestCode(email: string, now?: Date): Promise<AuthActionResponse<PurchaserOtpRequestData>>;
  verifyCode(
    input: { challengeId: string; code: string },
    now?: Date,
  ): Promise<PurchaserOtpVerificationResult>;
};

function authFailure(code: AuthFailure['error']['code'], message: string): AuthFailure {
  return { success: false, error: { code, message } };
}

function invalidOtp(): AuthFailure {
  return authFailure('OTP_INVALID', INVALID_OTP_MESSAGE);
}

function deliveryUnavailable(): AuthFailure {
  return authFailure('EMAIL_DELIVERY_UNAVAILABLE', DELIVERY_UNAVAILABLE_MESSAGE);
}

function resendAfterSeconds(requestedAt: Date, now: Date): number {
  const remainingMs = requestedAt.getTime() + PURCHASER_OTP_RESEND_COOLDOWN_MS - now.getTime();
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

export function createPurchaserOtpService(
  options: PurchaserOtpServiceOptions,
): PurchaserOtpService {
  const db = options.db ?? prisma;
  const codeGenerator = options.codeGenerator ?? generatePurchaserOtpCode;
  const challengeIdGenerator = options.challengeIdGenerator ?? generateSessionToken;

  return {
    async requestCode(email, now = new Date()) {
      if (
        !isPurchaserOtpSecretConfigured(options.otpSecret) ||
        !options.emailTransport.isConfigured()
      ) {
        return deliveryUnavailable();
      }

      const secret = options.otpSecret;
      const reservation = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`purchaser-otp:${email}`}, 0))`;

        const existing = await tx.purchaserEmailOtpChallenge.findUnique({
          where: { email },
        });
        const cooldownEndsAt = existing
          ? existing.requestedAt.getTime() + PURCHASER_OTP_RESEND_COOLDOWN_MS
          : 0;

        if (existing && existing.consumedAt === null && cooldownEndsAt > now.getTime()) {
          return {
            kind: existing.sentAt ? ('sent' as const) : ('pending' as const),
            challengeId: existing.id,
            resendAfterSeconds: resendAfterSeconds(existing.requestedAt, now),
          };
        }

        const challengeId = existing?.id ?? challengeIdGenerator();
        const version = (existing?.version ?? 0) + 1;
        const code = codeGenerator();
        const codeHash = hashPurchaserOtpCode(secret, challengeId, email, code);
        const expiresAt = new Date(now.getTime() + PURCHASER_OTP_TTL_MS);

        await tx.purchaserEmailOtpChallenge.upsert({
          where: { email },
          create: {
            id: challengeId,
            email,
            codeHash,
            expiresAt,
            attempts: 0,
            version,
            requestedAt: now,
          },
          update: {
            codeHash,
            expiresAt,
            attempts: 0,
            version,
            requestedAt: now,
            sentAt: null,
            consumedAt: null,
          },
        });

        return {
          kind: 'deliver' as const,
          challengeId,
          code,
          codeHash,
          version,
          resendAfterSeconds: Math.ceil(PURCHASER_OTP_RESEND_COOLDOWN_MS / 1000),
        };
      });

      if (reservation.kind !== 'deliver') {
        return {
          success: true,
          data: {
            challengeId: reservation.challengeId,
            resendAfterSeconds: reservation.resendAfterSeconds,
            delivery: reservation.kind,
          },
        };
      }

      try {
        await options.emailTransport.send({
          to: email,
          code: reservation.code,
          expiresInMinutes: PURCHASER_OTP_TTL_MS / 60_000,
          challengeId: reservation.challengeId,
          version: reservation.version,
        });

        const markedSent = await db.purchaserEmailOtpChallenge.updateMany({
          where: {
            id: reservation.challengeId,
            codeHash: reservation.codeHash,
            version: reservation.version,
            sentAt: null,
          },
          data: { sentAt: now },
        });
        if (markedSent.count !== 1) {
          throw new Error('Purchaser OTP challenge changed before delivery completed.');
        }
      } catch {
        await db.purchaserEmailOtpChallenge
          .deleteMany({
            where: {
              id: reservation.challengeId,
              codeHash: reservation.codeHash,
              version: reservation.version,
              sentAt: null,
            },
          })
          .catch(() => undefined);
        return deliveryUnavailable();
      }

      return {
        success: true,
        data: {
          challengeId: reservation.challengeId,
          resendAfterSeconds: reservation.resendAfterSeconds,
          delivery: 'sent',
        },
      };
    },

    async verifyCode(input, now = new Date()) {
      if (!isPurchaserOtpSecretConfigured(options.otpSecret)) {
        return deliveryUnavailable();
      }

      const secret = options.otpSecret;
      const result = await db.$transaction(async (tx) => {
        const challenge = await tx.purchaserEmailOtpChallenge.findUnique({
          where: { id: input.challengeId },
        });

        if (
          !challenge ||
          !challenge.sentAt ||
          challenge.consumedAt ||
          challenge.expiresAt <= now ||
          challenge.attempts >= PURCHASER_OTP_MAX_ATTEMPTS
        ) {
          return { ok: false as const };
        }

        const candidateHash = hashPurchaserOtpCode(
          secret,
          challenge.id,
          challenge.email,
          input.code,
        );
        if (!purchaserOtpHashMatches(candidateHash, challenge.codeHash)) {
          await tx.purchaserEmailOtpChallenge.updateMany({
            where: {
              id: challenge.id,
              consumedAt: null,
              expiresAt: { gt: now },
              attempts: { lt: PURCHASER_OTP_MAX_ATTEMPTS },
            },
            data: { attempts: { increment: 1 } },
          });
          return { ok: false as const };
        }

        const consumed = await tx.purchaserEmailOtpChallenge.updateMany({
          where: {
            id: challenge.id,
            codeHash: candidateHash,
            sentAt: { not: null },
            consumedAt: null,
            expiresAt: { gt: now },
            attempts: { lt: PURCHASER_OTP_MAX_ATTEMPTS },
          },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) {
          return { ok: false as const };
        }

        let user = await tx.user.findUnique({ where: { email: challenge.email } });
        if (!user) {
          const unreachablePassword = randomBytes(32).toString('base64url');
          const passwordHash = await hashPassword(unreachablePassword);
          user = await tx.user.upsert({
            where: { email: challenge.email },
            update: {},
            create: {
              email: challenge.email,
              passwordHash,
              preferredDisplayName: DEFAULT_PURCHASER_DISPLAY_NAME,
              role: UserRole.USER,
            },
          });
        }

        if (user.role !== UserRole.USER) {
          return { ok: false as const };
        }

        const session = await issueAuthSession(user, { client: tx, now });
        return { ok: true as const, session };
      });

      if (!result.ok) {
        return invalidOtp();
      }

      return {
        success: true,
        data: { user: result.session.user },
        session: result.session,
      };
    },
  };
}

function createConfiguredPurchaserOtpService(): PurchaserOtpService {
  return createPurchaserOtpService({
    emailTransport: createResendPurchaserOtpEmailTransport({
      apiKey: env.resendApiKey,
      from: env.resendFromEmail,
    }),
    otpSecret: env.purchaserOtpSecret,
  });
}

let activePurchaserOtpService = createConfiguredPurchaserOtpService();

export function getPurchaserOtpService(): PurchaserOtpService {
  return activePurchaserOtpService;
}

export function setPurchaserOtpServiceForTests(service: PurchaserOtpService | null): void {
  activePurchaserOtpService = service ?? createConfiguredPurchaserOtpService();
}
