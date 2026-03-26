-- CreateTable
CREATE TABLE "YouTubeIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encrypted_access_token" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT NOT NULL,
    "token_iv" TEXT NOT NULL,
    "token_auth_tag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelTitle" TEXT NOT NULL,
    "channelThumbnail" TEXT,
    "uploadsPlaylistId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeVideo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnail" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YouTubeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeNotificationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 7,
    "lastNotifiedAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeNotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeIntegration_userId_key" ON "YouTubeIntegration"("userId");

-- CreateIndex
CREATE INDEX "YouTubeIntegration_userId_idx" ON "YouTubeIntegration"("userId");

-- CreateIndex
CREATE INDEX "YouTubeSubscription_userId_idx" ON "YouTubeSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeSubscription_userId_channelId_key" ON "YouTubeSubscription"("userId", "channelId");

-- CreateIndex
CREATE INDEX "YouTubeVideo_userId_idx" ON "YouTubeVideo"("userId");

-- CreateIndex
CREATE INDEX "YouTubeVideo_userId_channelId_idx" ON "YouTubeVideo"("userId", "channelId");

-- CreateIndex
CREATE INDEX "YouTubeVideo_publishedAt_idx" ON "YouTubeVideo"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeVideo_userId_videoId_key" ON "YouTubeVideo"("userId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeNotificationSettings_userId_key" ON "YouTubeNotificationSettings"("userId");

-- CreateIndex
CREATE INDEX "YouTubeNotificationSettings_userId_idx" ON "YouTubeNotificationSettings"("userId");

-- AddForeignKey
ALTER TABLE "YouTubeIntegration" ADD CONSTRAINT "YouTubeIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeSubscription" ADD CONSTRAINT "YouTubeSub_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeSubscription" ADD CONSTRAINT "YouTubeSub_integration_fkey" FOREIGN KEY ("userId") REFERENCES "YouTubeIntegration"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeVideo" ADD CONSTRAINT "YouTubeVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeVideo" ADD CONSTRAINT "YouTubeVideo_userId_channelId_fkey" FOREIGN KEY ("userId", "channelId") REFERENCES "YouTubeSubscription"("userId", "channelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeNotificationSettings" ADD CONSTRAINT "YouTubeNotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
