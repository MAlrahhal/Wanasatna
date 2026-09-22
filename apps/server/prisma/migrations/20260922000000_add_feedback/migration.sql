-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('SUGGESTION', 'PROBLEM', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "FeedbackSource" AS ENUM ('LOBBY', 'GAMEPLAY', 'FINAL_RESULTS');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "source" "FeedbackSource" NOT NULL,
    "roomId" TEXT,
    "gameId" TEXT,
    "route" VARCHAR(200),
    "deviceCategory" VARCHAR(20),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_submissionId_key" ON "Feedback"("submissionId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_category_createdAt_idx" ON "Feedback"("category", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_gameId_createdAt_idx" ON "Feedback"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_source_createdAt_idx" ON "Feedback"("source", "createdAt");
