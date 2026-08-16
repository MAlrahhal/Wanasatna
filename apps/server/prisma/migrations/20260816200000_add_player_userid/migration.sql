-- AlterTable
ALTER TABLE "Player" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "Player_userId_idx" ON "Player"("userId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
