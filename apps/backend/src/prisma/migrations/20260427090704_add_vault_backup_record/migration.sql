-- CreateTable
CREATE TABLE "VaultBackupRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "schemaVersion" INTEGER NOT NULL,
    "blobTypes" TEXT[],
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultBackupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultBackupRecord_userId_createdAt_idx" ON "VaultBackupRecord"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "VaultBackupRecord" ADD CONSTRAINT "VaultBackupRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
