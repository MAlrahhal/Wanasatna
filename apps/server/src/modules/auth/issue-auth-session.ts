import { Prisma, type User } from '@prisma/client';
import type { PublicUser } from '@wanasatna/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { generateSessionToken, hashSessionToken } from './session-token.js';

export type IssuedAuthSession = {
  user: PublicUser;
  sessionToken: string;
  expiresAt: Date;
};

type AuthSessionClient = Pick<Prisma.TransactionClient, 'authSession'>;

function toPublicUser(
  user: Pick<User, 'id' | 'email' | 'preferredDisplayName' | 'role'>,
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    preferredDisplayName: user.preferredDisplayName,
    role: user.role,
  };
}

export async function issueAuthSession(
  user: Pick<User, 'id' | 'email' | 'preferredDisplayName' | 'role'>,
  options: {
    client?: AuthSessionClient;
    mfaVerifiedAt?: Date | null;
    now?: Date;
  } = {},
): Promise<IssuedAuthSession> {
  const client = options.client ?? prisma;
  const now = options.now ?? new Date();
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(now.getTime() + env.authSessionTtlMs);

  await client.authSession.deleteMany({
    where: {
      userId: user.id,
      expiresAt: { lte: now },
    },
  });

  await client.authSession.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt,
      mfaVerifiedAt: options.mfaVerifiedAt ?? null,
    },
  });

  return {
    user: toPublicUser(user),
    sessionToken,
    expiresAt,
  };
}
