-- Add admin MFA state, MFA-aware sessions, and durable admin audit records.

ALTER TABLE "AuthSession" ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);

CREATE TABLE "AdminTotpCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "enabledAt" TIMESTAMP(3),
    "lastUsedStep" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminTotpCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminMfaChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminMfaChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "outcome" TEXT NOT NULL,
    "requestId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminTotpCredential_userId_key" ON "AdminTotpCredential"("userId");
CREATE UNIQUE INDEX "AdminMfaChallenge_tokenHash_key" ON "AdminMfaChallenge"("tokenHash");
CREATE INDEX "AdminMfaChallenge_userId_expiresAt_idx" ON "AdminMfaChallenge"("userId", "expiresAt");
CREATE INDEX "AdminMfaChallenge_expiresAt_idx" ON "AdminMfaChallenge"("expiresAt");
CREATE UNIQUE INDEX "AdminRecoveryCode_userId_codeHash_key" ON "AdminRecoveryCode"("userId", "codeHash");
CREATE INDEX "AdminRecoveryCode_userId_usedAt_idx" ON "AdminRecoveryCode"("userId", "usedAt");
CREATE INDEX "AdminAuditLog_occurredAt_idx" ON "AdminAuditLog"("occurredAt");
CREATE INDEX "AdminAuditLog_action_occurredAt_idx" ON "AdminAuditLog"("action", "occurredAt");
CREATE INDEX "AdminAuditLog_actorUserId_occurredAt_idx" ON "AdminAuditLog"("actorUserId", "occurredAt");
CREATE INDEX "AdminAuditLog_targetType_targetId_occurredAt_idx" ON "AdminAuditLog"("targetType", "targetId", "occurredAt");

ALTER TABLE "AdminTotpCredential" ADD CONSTRAINT "AdminTotpCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminMfaChallenge" ADD CONSTRAINT "AdminMfaChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminRecoveryCode" ADD CONSTRAINT "AdminRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
