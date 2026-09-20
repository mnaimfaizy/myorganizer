-- CreateTable
CREATE TABLE "YouTubeWatchedLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YouTubeWatchedLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YouTubeWatchedLedger_userId_idx" ON "YouTubeWatchedLedger"("userId");

-- CreateIndex
CREATE INDEX "YouTubeWatchedLedger_createdAt_idx" ON "YouTubeWatchedLedger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeWatchedLedger_userId_videoId_key" ON "YouTubeWatchedLedger"("userId", "videoId");

-- AddForeignKey
ALTER TABLE "YouTubeWatchedLedger" ADD CONSTRAINT "YouTubeWatchedLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
