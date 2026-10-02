import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { EntitlementGrantCandidate } from './entitlement-policy.js';

type EntitlementReadDb = Pick<Prisma.TransactionClient, 'entitlementGrant'>;

export type EntitlementGrantLookup = {
  userId: string;
  entitlementKey: string;
  at: Date;
};

export type EntitlementGrantReader = {
  findPotentiallyActive(lookup: EntitlementGrantLookup): Promise<EntitlementGrantCandidate[]>;
};

export function createPrismaEntitlementGrantReader(
  db: EntitlementReadDb = prisma,
): EntitlementGrantReader {
  return {
    findPotentiallyActive(lookup) {
      return db.entitlementGrant.findMany({
        where: {
          userId: lookup.userId,
          entitlementKey: lookup.entitlementKey,
          startsAt: { lte: lookup.at },
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: lookup.at } }],
        },
        select: {
          id: true,
          userId: true,
          entitlementKey: true,
          startsAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      });
    },
  };
}

export const prismaEntitlementGrantReader = createPrismaEntitlementGrantReader();
