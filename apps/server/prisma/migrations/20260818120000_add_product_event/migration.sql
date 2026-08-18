-- Additive ProductEvent. No FK to Room. No DROP.

CREATE TYPE "ProductEventType" AS ENUM (
  'ROOM_CREATED',
  'ROOM_JOINED',
  'SPECTATOR_JOINED',
  'RECONNECT_SUCCEEDED',
  'ROOM_CLOSED'
);

CREATE TABLE "ProductEvent" (
    "id" TEXT NOT NULL,
    "type" "ProductEventType" NOT NULL,
    "roomId" TEXT,
    "gameId" TEXT,
    "roomCap" INTEGER,
    "playerCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductEvent_type_createdAt_idx" ON "ProductEvent"("type", "createdAt");
CREATE INDEX "ProductEvent_createdAt_idx" ON "ProductEvent"("createdAt");
CREATE INDEX "ProductEvent_roomId_idx" ON "ProductEvent"("roomId");
