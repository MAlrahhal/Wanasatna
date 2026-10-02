-- Additive provider-independent grants. Existing users, players, rooms, and games are untouched.
CREATE TABLE "EntitlementGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entitlementKey" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntitlementGrant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EntitlementGrant_entitlementKey_valid" CHECK (length("entitlementKey") > 0 AND "entitlementKey" !~ '^[[:space:]]' AND "entitlementKey" !~ '[[:space:]]$'),
    CONSTRAINT "EntitlementGrant_source_valid" CHECK (length("source") > 0 AND "source" !~ '^[[:space:]]' AND "source" !~ '[[:space:]]$'),
    CONSTRAINT "EntitlementGrant_sourceRef_valid" CHECK (length("sourceRef") > 0 AND "sourceRef" !~ '^[[:space:]]' AND "sourceRef" !~ '[[:space:]]$'),
    CONSTRAINT "EntitlementGrant_valid_window" CHECK ("expiresAt" IS NULL OR "expiresAt" > "startsAt")
);

CREATE UNIQUE INDEX "EntitlementGrant_source_sourceRef_entitlementKey_key"
ON "EntitlementGrant"("source", "sourceRef", "entitlementKey");

CREATE INDEX "EntitlementGrant_userId_entitlementKey_startsAt_idx"
ON "EntitlementGrant"("userId", "entitlementKey", "startsAt");

ALTER TABLE "EntitlementGrant"
ADD CONSTRAINT "EntitlementGrant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
