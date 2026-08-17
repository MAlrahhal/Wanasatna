import type { PublicUser } from '@wanasatna/shared';

export function toAdminPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    preferredDisplayName: user.preferredDisplayName,
    role: user.role,
  };
}
