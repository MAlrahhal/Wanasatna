import { Prisma, UserRole, type User } from '@prisma/client';
import type {
  AdminMfaChallengeData,
  AuthActionResponse,
  AuthSessionData,
  PublicUser,
} from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';
import { createAdminMfaChallenge } from './admin-mfa.service.js';
import { hashPassword, verifyPasswordOrDummy } from './password.js';
import { issueAuthSession, type IssuedAuthSession } from './issue-auth-session.js';
import { hashSessionToken } from './session-token.js';
import { validateLoginPayload, validateRegisterPayload } from './auth.validators.js';

export type { IssuedAuthSession } from './issue-auth-session.js';

type LoginUserResult =
  | ({ success: true; data: AuthSessionData } & { session: IssuedAuthSession })
  | { success: true; data: AdminMfaChallengeData }
  | Extract<AuthActionResponse<never>, { success: false }>;

function authError(
  code: Extract<AuthActionResponse<never>, { success: false }>['error']['code'],
  message: string,
): Extract<AuthActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: { code, message },
  };
}

export function toPublicUser(
  user: Pick<User, 'id' | 'email' | 'preferredDisplayName' | 'role'>,
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    preferredDisplayName: user.preferredDisplayName,
    role: user.role,
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

    const session = await issueAuthSession(user);
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

export async function loginUser(payload: unknown): Promise<LoginUserResult> {
  const validation = validateLoginPayload(payload);

  if (!validation.success) {
    return validation;
  }

  const { email, password } = validation.data;
  const user = await prisma.user.findUnique({
    where: { email },
    include: { adminTotpCredential: true },
  });
  const passwordOk = await verifyPasswordOrDummy(user?.passwordHash ?? null, password);

  if (!user || !passwordOk) {
    return authError('INVALID_CREDENTIALS', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }

  if (user.role === UserRole.ADMIN && user.adminTotpCredential?.enabledAt) {
    const challengeToken = await createAdminMfaChallenge(user.id);
    return {
      success: true,
      data: { mfaRequired: true, challengeToken },
    };
  }

  const session = await issueAuthSession(user);
  return {
    success: true,
    data: { user: session.user },
    session,
  };
}

export async function resolveAuthSession(
  sessionToken: string | undefined,
  options: { requireAdminMfa?: boolean } = {},
): Promise<PublicUser | null> {
  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);
  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: { adminTotpCredential: true },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const mfaEnabledAt = session.user.adminTotpCredential?.enabledAt;
  if (
    options.requireAdminMfa &&
    session.user.role === UserRole.ADMIN &&
    mfaEnabledAt &&
    (!session.mfaVerifiedAt || session.mfaVerifiedAt < mfaEnabledAt)
  ) {
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
