import { Prisma, UserRole, type User } from '@prisma/client';
import type { AuthActionResponse, AuthSessionData, PublicUser } from '@wanasatna/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPasswordOrDummy } from './password.js';
import { generateSessionToken, hashSessionToken } from './session-token.js';
import { validateLoginPayload, validateRegisterPayload } from './auth.validators.js';

export type IssuedAuthSession = {
  user: PublicUser;
  sessionToken: string;
  expiresAt: Date;
};

function authError(
  code: Extract<AuthActionResponse<never>, { success: false }>['error']['code'],
  message: string,
): Extract<AuthActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: { code, message },
  };
}

export function toPublicUser(user: Pick<User, 'id' | 'email' | 'preferredDisplayName' | 'role'>): PublicUser {
  return {
    id: user.id,
    email: user.email,
    preferredDisplayName: user.preferredDisplayName,
    role: user.role,
  };
}

async function issueSession(user: User): Promise<IssuedAuthSession> {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + env.authSessionTtlMs);

  await prisma.authSession.deleteMany({
    where: {
      userId: user.id,
      expiresAt: { lte: new Date() },
    },
  });

  await prisma.authSession.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt,
    },
  });

  return {
    user: toPublicUser(user),
    sessionToken,
    expiresAt,
  };
}

export async function registerUser(
  payload: unknown,
): Promise<AuthActionResponse<AuthSessionData> & { session?: IssuedAuthSession }> {
  const validation = validateRegisterPayload(payload);

  if (!validation.success) {
    return validation;
  }

  const { email, password, preferredDisplayName } = validation.data;
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        preferredDisplayName,
        role: UserRole.USER,
      },
    });

    const session = await issueSession(user);
    return {
      success: true,
      data: { user: session.user },
      session,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return authError('EMAIL_TAKEN', 'هذا البريد مسجّل مسبقاً.');
    }

    throw error;
  }
}

export async function loginUser(
  payload: unknown,
): Promise<AuthActionResponse<AuthSessionData> & { session?: IssuedAuthSession }> {
  const validation = validateLoginPayload(payload);

  if (!validation.success) {
    return validation;
  }

  const { email, password } = validation.data;
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await verifyPasswordOrDummy(user?.passwordHash ?? null, password);

  if (!user || !passwordOk) {
    return authError('INVALID_CREDENTIALS', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }

  const session = await issueSession(user);
  return {
    success: true,
    data: { user: session.user },
    session,
  };
}

export async function resolveAuthSession(sessionToken: string | undefined): Promise<PublicUser | null> {
  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);
  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return toPublicUser(session.user);
}

export async function logoutAuthSession(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken) {
    return;
  }

  await prisma.authSession.deleteMany({
    where: { tokenHash: hashSessionToken(sessionToken) },
  });
}
