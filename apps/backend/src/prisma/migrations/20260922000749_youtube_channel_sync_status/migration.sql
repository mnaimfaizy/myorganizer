-- AlterTable
ALTER TABLE "YouTubeIntegration" ADD COLUMN     "lastChannelSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastChannelSyncError" TEXT,
ADD COLUMN     "lastChannelSyncStatus" TEXT NOT NULL DEFAULT 'never';
