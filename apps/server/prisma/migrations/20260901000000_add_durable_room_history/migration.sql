-- Add durable room lifecycle history without backfilling ambiguous deleted rooms or Matches.

CREATE TYPE "RoomCloseReason" AS ENUM (
    'ROOM_EMPTY',
    'HOST_ENDED',
    'ADMIN_FORCE_CLOSED',
    'STARTUP_RECONCILIATION'
);

ALTER TABLE "Room" ADD COLUMN "historyId" TEXT;
ALTER TABLE "Match" ADD COLUMN "roomHistoryId" TEXT;

CREATE TABLE "RoomHistory" (
    "id" TEXT NOT NULL,
    "liveRoomId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "originalHostName" TEXT,
    "currentHostPlayerId" TEXT NOT NULL,
    "currentHostName" TEXT NOT NULL,
    "playerCap" INTEGER NOT NULL,
    "isLocked" BOOLEAN NOT NULL,
    "wasEverLocked" BOOLEAN,
    "createdByAdmin" BOOLEAN,
    "isComplete" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "historyStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closeReason" "RoomCloseReason",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomParticipationHistory" (
    "id" TEXT NOT NULL,
    "roomHistoryId" TEXT NOT NULL,
    "livePlayerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),
    "joinedAsSpectator" BOOLEAN,
    "wasHost" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomParticipationHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomHostHistory" (
    "id" TEXT NOT NULL,
    "roomHistoryId" TEXT NOT NULL,
    "livePlayerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomHostHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Room_historyId_key" ON "Room"("historyId");
CREATE UNIQUE INDEX "RoomHistory_liveRoomId_key" ON "RoomHistory"("liveRoomId");
CREATE INDEX "RoomHistory_createdAt_idx" ON "RoomHistory"("createdAt");
CREATE INDEX "RoomHistory_closedAt_idx" ON "RoomHistory"("closedAt");
CREATE INDEX "RoomHistory_roomCode_idx" ON "RoomHistory"("roomCode");
CREATE UNIQUE INDEX "RoomParticipationHistory_roomHistoryId_livePlayerId_key"
    ON "RoomParticipationHistory"("roomHistoryId", "livePlayerId");
CREATE INDEX "RoomParticipationHistory_roomHistoryId_joinedAt_idx"
    ON "RoomParticipationHistory"("roomHistoryId", "joinedAt");
CREATE INDEX "RoomParticipationHistory_displayName_idx"
    ON "RoomParticipationHistory"("displayName");
CREATE UNIQUE INDEX "RoomHostHistory_roomHistoryId_livePlayerId_key"
    ON "RoomHostHistory"("roomHistoryId", "livePlayerId");
CREATE INDEX "RoomHostHistory_roomHistoryId_assignedAt_idx"
    ON "RoomHostHistory"("roomHistoryId", "assignedAt");
CREATE INDEX "Match_roomHistoryId_idx" ON "Match"("roomHistoryId");

ALTER TABLE "Room" ADD CONSTRAINT "Room_historyId_fkey"
    FOREIGN KEY ("historyId") REFERENCES "RoomHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomParticipationHistory" ADD CONSTRAINT "RoomParticipationHistory_roomHistoryId_fkey"
    FOREIGN KEY ("roomHistoryId") REFERENCES "RoomHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomHostHistory" ADD CONSTRAINT "RoomHostHistory_roomHistoryId_fkey"
    FOREIGN KEY ("roomHistoryId") REFERENCES "RoomHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_roomHistoryId_fkey"
    FOREIGN KEY ("roomHistoryId") REFERENCES "RoomHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
