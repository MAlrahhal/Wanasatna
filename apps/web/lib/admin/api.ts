import type { AdminMeData, AuthActionResponse, PublicUser } from '@wanasatna/shared';
import { getServerUrl } from '@/lib/config/server-url';

export type AdminMeResult =
  | { ok: true; user: PublicUser }
  | { ok: false; status: number };

function adminUrl(path: string): string {
  return `${getServerUrl()}/api/admin${path}`;
}

function pickSafeAdminUser(value: unknown): PublicUser | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.email !== 'string' ||
    typeof record.preferredDisplayName !== 'string' ||
    (record.role !== 'USER' && record.role !== 'ADMIN')
  ) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    preferredDisplayName: record.preferredDisplayName,
    role: record.role,
  };
}

export async function fetchAdminMe(): Promise<AdminMeResult> {
  try {
    const response = await fetch(adminUrl('/me'), {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const body = (await response.json()) as AuthActionResponse<AdminMeData>;
    const user = body.success ? pickSafeAdminUser(body.data.user) : null;

    if (!user || user.role !== 'ADMIN') {
      return { ok: false, status: 403 };
    }

    return { ok: true, user };
  } catch {
    return { ok: false, status: 0 };
  }
}
