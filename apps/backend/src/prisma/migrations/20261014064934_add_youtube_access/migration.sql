-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminAuditAction" ADD VALUE 'youtube_access_grant';
ALTER TYPE "AdminAuditAction" ADD VALUE 'youtube_access_withdraw';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "youtube_access" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "youtube_access_first_granted_at" TIMESTAMP(3);
