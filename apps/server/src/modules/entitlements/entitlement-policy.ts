export type EntitlementGrantCandidate = {
  id: string;
  userId: string;
  entitlementKey: string;
  startsAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

export type EntitlementCheck = {
  userId: string;
  entitlementKey: string;
  at: Date;
};

function validTimestamp(value: Date): number | null {
  const timestamp = value.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function assertValidEntitlementCheckTime(at: Date): void {
  if (validTimestamp(at) === null) {
    throw new TypeError('Entitlement evaluation time must be a valid Date.');
  }
}

/** Active windows are start-inclusive and expiration-exclusive: [startsAt, expiresAt). */
export function grantAuthorizesEntitlementAt(
  grant: EntitlementGrantCandidate,
  check: EntitlementCheck,
): boolean {
  const at = validTimestamp(check.at);
  const startsAt = validTimestamp(grant.startsAt);
  const expiresAt = grant.expiresAt ? validTimestamp(grant.expiresAt) : null;

  if (at === null || startsAt === null || (grant.expiresAt && expiresAt === null)) {
    return false;
  }

  if (grant.userId !== check.userId || grant.entitlementKey !== check.entitlementKey) {
    return false;
  }

  if (grant.revokedAt !== null || startsAt > at) {
    return false;
  }

  return expiresAt === null || at < expiresAt;
}

export function grantsAuthorizeEntitlementAt(
  grants: readonly EntitlementGrantCandidate[],
  check: EntitlementCheck,
): boolean {
  return grants.some((grant) => grantAuthorizesEntitlementAt(grant, check));
}
