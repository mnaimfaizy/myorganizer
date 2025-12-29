-- CreateTable
CREATE TABLE "EncryptedVault" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kdf_name" TEXT NOT NULL,
    "kdf_salt" TEXT NOT NULL,
    "kdf_params" JSONB NOT NULL,
    "wrapped_mk_passphrase" JSONB NOT NULL,
    "wrapped_mk_recovery" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncryptedVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncryptedVaultBlob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "blob" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncryptedVaultBlob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EncryptedVault_userId_key" ON "EncryptedVault"("userId");

-- CreateIndex
CREATE INDEX "EncryptedVault_userId_idx" ON "EncryptedVault"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EncryptedVaultBlob_userId_type_key" ON "EncryptedVaultBlob"("userId", "type");

-- CreateIndex
CREATE INDEX "EncryptedVaultBlob_userId_idx" ON "EncryptedVaultBlob"("userId");

-- AddForeignKey
ALTER TABLE "EncryptedVault" ADD CONSTRAINT "EncryptedVault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptedVaultBlob" ADD CONSTRAINT "EncryptedVaultBlob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "EncryptedVault"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
