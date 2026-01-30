-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isWishlisted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "refresh_token_revocations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_revocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_revocations_tokenHash_key" ON "refresh_token_revocations"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_token_revocations_userId_idx" ON "refresh_token_revocations"("userId");

-- CreateIndex
CREATE INDEX "refresh_token_revocations_revokedAt_idx" ON "refresh_token_revocations"("revokedAt");
