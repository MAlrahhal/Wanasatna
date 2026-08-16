-- CreateIndex
CREATE INDEX "Player_status_lastSeenAt_idx" ON "Player"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
