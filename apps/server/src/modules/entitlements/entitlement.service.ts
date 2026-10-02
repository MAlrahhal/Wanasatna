import {
  prismaEntitlementGrantReader,
  type EntitlementGrantReader,
} from './entitlement.repository.js';
import {
  assertValidEntitlementCheckTime,
  grantsAuthorizeEntitlementAt,
} from './entitlement-policy.js';

export type UserEntitlementRequest = {
  /** Must come from a current AuthSession or controlled server job, never Player.userId or a payload. */
  userId: string | null | undefined;
  entitlementKey: string;
  at?: Date;
};

/**
 * Server-authoritative entitlement check. Database failures propagate so callers cannot fail open.
 * Player identity, room host status, socket payloads, and client caches are intentionally absent.
 */
export async function hasActiveUserEntitlement(
  request: UserEntitlementRequest,
  reader: EntitlementGrantReader = prismaEntitlementGrantReader,
): Promise<boolean> {
  if (!request.userId?.trim()) {
    return false;
  }

  if (!request.entitlementKey || request.entitlementKey !== request.entitlementKey.trim()) {
    return false;
  }

  const at = request.at ?? new Date();
  assertValidEntitlementCheckTime(at);

  const grants = await reader.findPotentiallyActive({
    userId: request.userId,
    entitlementKey: request.entitlementKey,
    at,
  });

  return grantsAuthorizeEntitlementAt(grants, {
    userId: request.userId,
    entitlementKey: request.entitlementKey,
    at,
  });
}
