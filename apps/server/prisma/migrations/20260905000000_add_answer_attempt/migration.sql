-- Support/debug answer logs for Draw & Guess, Guessing Challenge, and Fast Answer.
-- Retention deletes AnswerAttempt rows only; RoomHistory and Match are untouched.

CREATE TYPE "AnswerAttemptStatus" AS ENUM (
    'CORRECT_COUNTED',
    'CORRECT_NOT_COUNTED',
    'WRONG_COUNTED',
    'WRONG_NOT_COUNTED',
    'REJECTED',
    'LATE',
    'OUT_OF_TURN',
    'DUPLICATE'
);

CREATE TYPE "AnswerRejectReason" AS ENUM (
    'VALIDATION',
    'NOT_PARTICIPANT',
    'INVALID_ROLE',
    'RECOVERY',
    'EMPTY',
    'OVERSIZED',
    'GAME_NOT_READY'
);

CREATE TABLE "AnswerAttempt" (
    "id" TEXT NOT NULL,
    "roomHistoryId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "livePlayerId" TEXT,
    "playerDisplayName" TEXT NOT NULL,
    "rawAnswer" VARCHAR(200) NOT NULL,
    "normalizedAnswer" VARCHAR(200),
    "status" "AnswerAttemptStatus" NOT NULL,
    "rejectReason" "AnswerRejectReason",
    "wasCorrect" BOOLEAN,
    "wasCounted" BOOLEAN NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "roundIndex" INTEGER,
    "roundId" TEXT,
    "turnId" TEXT,
    "promptId" TEXT,
    "promptText" VARCHAR(200) NOT NULL,
    "teamId" TEXT,

    CONSTRAINT "AnswerAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnswerAttempt_matchId_submittedAt_idx" ON "AnswerAttempt"("matchId", "submittedAt");
CREATE INDEX "AnswerAttempt_roomHistoryId_submittedAt_idx" ON "AnswerAttempt"("roomHistoryId", "submittedAt");
CREATE INDEX "AnswerAttempt_submittedAt_idx" ON "AnswerAttempt"("submittedAt");
CREATE INDEX "AnswerAttempt_gameId_submittedAt_idx" ON "AnswerAttempt"("gameId", "submittedAt");
CREATE INDEX "AnswerAttempt_matchId_status_submittedAt_idx" ON "AnswerAttempt"("matchId", "status", "submittedAt");

ALTER TABLE "AnswerAttempt" ADD CONSTRAINT "AnswerAttempt_roomHistoryId_fkey" FOREIGN KEY ("roomHistoryId") REFERENCES "RoomHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnswerAttempt" ADD CONSTRAINT "AnswerAttempt_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
