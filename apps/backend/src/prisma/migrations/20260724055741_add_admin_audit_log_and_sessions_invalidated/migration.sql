-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('disable', 'enable', 'force_logout', 'resend_verification', 'promote', 'demote');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessions_invalidated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_created_at_idx" ON "AdminAuditLog"("created_at");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actor_user_id_idx" ON "AdminAuditLog"("actor_user_id");

-- CreateIndex
CREATE INDEX "AdminAuditLog_target_user_id_idx" ON "AdminAuditLog"("target_user_id");

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
