-- AlterTable
-- Nullable on purpose: existing Cached Uploads were synced before duration was
-- collected, so they stay unclassified until the next sync backfills them.
-- Unclassified rows are treated as long-form, never as Shorts.
ALTER TABLE "YouTubeVideo" ADD COLUMN     "durationSeconds" INTEGER;
