-- AlterTable
ALTER TABLE "YouTubeIntegration" ADD COLUMN     "lastManualRefreshAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncError" TEXT,
ADD COLUMN     "lastSyncStatus" TEXT NOT NULL DEFAULT 'never';

-- AlterTable
ALTER TABLE "YouTubeSubscription" ADD COLUMN     "disabledAt" TIMESTAMP(3);
