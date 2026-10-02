CREATE TABLE "PurchaserEmailOtpChallenge" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "codeHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaserEmailOtpChallenge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PurchaserEmailOtpChallenge_email_valid" CHECK (
        length("email") BETWEEN 3 AND 254
        AND "email" = lower("email")
        AND "email" !~ '^[[:space:]]'
        AND "email" !~ '[[:space:]]$'
        AND "email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
    CONSTRAINT "PurchaserEmailOtpChallenge_codeHash_valid" CHECK (
        "codeHash" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "PurchaserEmailOtpChallenge_attempts_valid" CHECK (
        "attempts" BETWEEN 0 AND 5
    ),
    CONSTRAINT "PurchaserEmailOtpChallenge_version_valid" CHECK ("version" > 0),
    CONSTRAINT "PurchaserEmailOtpChallenge_expiry_valid" CHECK (
        "expiresAt" > "requestedAt"
    ),
    CONSTRAINT "PurchaserEmailOtpChallenge_sentAt_valid" CHECK (
        "sentAt" IS NULL
        OR ("sentAt" >= "requestedAt" AND "sentAt" < "expiresAt")
    ),
    CONSTRAINT "PurchaserEmailOtpChallenge_consumedAt_valid" CHECK (
        "consumedAt" IS NULL
        OR ("sentAt" IS NOT NULL AND "consumedAt" >= "sentAt" AND "consumedAt" < "expiresAt")
    )
);

CREATE UNIQUE INDEX "PurchaserEmailOtpChallenge_email_key"
ON "PurchaserEmailOtpChallenge"("email");

CREATE INDEX "PurchaserEmailOtpChallenge_expiresAt_idx"
ON "PurchaserEmailOtpChallenge"("expiresAt");
