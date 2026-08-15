-- AlterTable
ALTER TABLE "YouTubeNotificationSettings" ADD COLUMN     "optedInAt" TIMESTAMP(3),
ADD COLUMN     "preferredWeekday" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "timeZone" TEXT,
ADD COLUMN     "unsubscribeToken" TEXT,
ALTER COLUMN "enabled" SET DEFAULT false;

-- CreateTable
CREATE TABLE "YouTubeDigestDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'claimed',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeDigestDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeWorkerLease" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cursor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeWorkerLease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YouTubeDigestDelivery_userId_idx" ON "YouTubeDigestDelivery"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeDigestDelivery_userId_periodKey_key" ON "YouTubeDigestDelivery"("userId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeWorkerLease_name_key" ON "YouTubeWorkerLease"("name");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeNotificationSettings_unsubscribeToken_key" ON "YouTubeNotificationSettings"("unsubscribeToken");

-- AddForeignKey
ALTER TABLE "YouTubeDigestDelivery" ADD CONSTRAINT "YouTubeDigestDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The weekly digest becomes opt-in. Rows created under the old opt-out default
-- were never an explicit choice, so clear them; Users re-enable from settings.
UPDATE "YouTubeNotificationSettings" SET "enabled" = false WHERE "optedInAt" IS NULL;
