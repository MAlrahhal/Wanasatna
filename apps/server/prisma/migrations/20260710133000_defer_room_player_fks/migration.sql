-- Allow Room and Player to be inserted in one transaction (circular host/room FK).

ALTER TABLE "Room" DROP CONSTRAINT "Room_hostPlayerId_fkey";

ALTER TABLE "Player" DROP CONSTRAINT "Player_roomId_fkey";

ALTER TABLE "Room"
ADD CONSTRAINT "Room_hostPlayerId_fkey"
FOREIGN KEY ("hostPlayerId") REFERENCES "Player"("id")
ON DELETE RESTRICT ON UPDATE CASCADE
DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "Player"
ADD CONSTRAINT "Player_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id")
ON DELETE CASCADE ON UPDATE CASCADE
DEFERRABLE INITIALLY DEFERRED;
