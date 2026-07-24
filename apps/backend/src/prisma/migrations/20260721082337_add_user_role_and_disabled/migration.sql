-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'platform_admin');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'user';

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
