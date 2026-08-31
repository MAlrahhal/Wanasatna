import { getServerUrl } from '@/lib/config/server-url';
import type {
  AdminMfaVerifyInput,
  AuthActionResponse,
  AuthLoginData,
  AuthMeData,
  AuthSessionData,
  PublicUser,
} from '@wanasatna/shared';
import { AUTH_COPY } from '@/lib/auth/copy';

function authUrl(path: string): string {
  return `${getServerUrl()}/api/auth${path}`;
}

function connectionFailure<T>(): AuthActionResponse<T> {
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: AUTH_COPY.connectionFailed,
    },
  };
}

async function parseAuthResponse<T>(response: Response): Promise<AuthActionResponse<T>> {
  try {
    const body = (await response.json()) as AuthActionResponse<T>;
    if (body && typeof body === 'object' && 'success' in body) {
      return body;
    }
  } catch {
    // fall through
  }

  return connectionFailure<T>();
}

export async function fetchAuthMe(): Promise<PublicUser | null> {
  try {
    const response = await fetch(authUrl('/me'), {
      method: 'GET',
      credentials: 'include',
    });
    const body = await parseAuthResponse<AuthMeData>(response);
    return body.success ? body.data.user : null;
  } catch {
    return null;
  }
}

export async function registerAccount(input: {
  email: string;
  password: string;
  preferredDisplayName: string;
}): Promise<AuthActionResponse<AuthSessionData>> {
  try {
    const response = await fetch(authUrl('/register'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        preferredDisplayName: input.preferredDisplayName,
      }),
    });
    return parseAuthResponse<AuthSessionData>(response);
  } catch {
    return connectionFailure();
  }
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<AuthActionResponse<AuthLoginData>> {
  try {
    const response = await fetch(authUrl('/login'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
    });
    return parseAuthResponse<AuthLoginData>(response);
  } catch {
    return connectionFailure();
  }
}

export async function verifyAdminMfa(
  input: AdminMfaVerifyInput,
): Promise<AuthActionResponse<AuthSessionData>> {
  try {
    const response = await fetch(authUrl('/mfa/verify'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return parseAuthResponse<AuthSessionData>(response);
  } catch {
    return connectionFailure();
  }
}

export async function logoutAccount(): Promise<void> {
  try {
    await fetch(authUrl('/logout'), {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Local guest state still applies if the network call fails.
  }
}
