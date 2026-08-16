-- P12-B.7.2: drop unused legacy Session / ChatMessage and dead Room columns.
-- AuthSession, Match, MatchParticipant, RoomStatus, and Player.isSpectator are untouched.
-- NOT APPLIED. Owner must approve `prisma migrate deploy`.

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_playerId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_roomId_fkey";

-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT "Room_activeSessionId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_roomId_fkey";

-- DropIndex
DROP INDEX "Room_activeSessionId_key";

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "activeSessionId",
DROP COLUMN "sessionType";

-- DropTable
DROP TABLE "ChatMessage";

-- DropTable
DROP TABLE "Session";

-- DropEnum
DROP TYPE "ChatMessageType";

-- DropEnum
DROP TYPE "SessionStatus";

-- DropEnum
DROP TYPE "SessionType";
