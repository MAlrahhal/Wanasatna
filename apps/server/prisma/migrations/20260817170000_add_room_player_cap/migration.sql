-- Additive Room.playerCap. Existing rows become 8. No DROP.

ALTER TABLE "Room" ADD COLUMN "playerCap" INTEGER NOT NULL DEFAULT 8;
