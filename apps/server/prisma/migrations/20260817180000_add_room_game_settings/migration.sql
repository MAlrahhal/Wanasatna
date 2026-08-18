-- Additive Room.gameSettings. Existing rows stay null (defaults). No DROP.

ALTER TABLE "Room" ADD COLUMN "gameSettings" JSONB;
