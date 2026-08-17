import { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type PromotedAdminUser = {
  id: string;
  email: string;
  role: 'ADMIN';
};

/**
 * One-time owner bootstrap: promote an existing User to ADMIN.
 * Never creates a User. Match is exact email (normalized like login) or exact id.
 */
export async function promoteExistingUserToAdmin(identifier: string): Promise<PromotedAdminUser> {
  const trimmed = identifier.trim();

  if (!trimmed) {
    throw new Error('No matching User. Promotion aborted.');
  }

  const existing = trimmed.includes('@')
    ? await prisma.user.findUnique({
        where: { email: trimmed.toLowerCase() },
        select: { id: true },
      })
    : await prisma.user.findUnique({
        where: { id: trimmed },
        select: { id: true },
      });

  if (!existing) {
    throw new Error('No matching User. Promotion aborted.');
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { role: UserRole.ADMIN },
    select: { id: true, email: true, role: true },
  });

  return {
    id: updated.id,
    email: updated.email,
    role: 'ADMIN',
  };
}
