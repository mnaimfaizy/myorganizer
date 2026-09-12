-- AlterTable
ALTER TABLE "YouTubeSubscription" ADD COLUMN     "lastSyncAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncError" TEXT;
