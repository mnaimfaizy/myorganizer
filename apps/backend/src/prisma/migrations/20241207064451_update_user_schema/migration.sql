/*
  Warnings:

  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "blacklisted_tokens" TEXT[],
ADD COLUMN     "email_verification_timestamp" TIMESTAMP(3),
ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "reset_password_token" TEXT;

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
