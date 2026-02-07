/*
  Warnings:

  - You are about to drop the column `createdAt` on the `refresh_token_revocations` table. All the data in the column will be lost.
  - You are about to drop the `payment_history` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "refresh_token_revocations" DROP COLUMN "createdAt";

-- DropTable
DROP TABLE "payment_history";

-- AddForeignKey
ALTER TABLE "refresh_token_revocations" ADD CONSTRAINT "refresh_token_revocations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
