-- Additive GameAdminConfig. Missing rows mean enabled. No DROP.

CREATE TABLE "GameAdminConfig" (
    "gameId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameAdminConfig_pkey" PRIMARY KEY ("gameId")
);
