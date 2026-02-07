/*
  Warnings:

  - You are about to drop the column `cartId` on the `cart_items` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `categories` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `order_items` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to drop the column `shipping` on the `orders` table. All the data in the column will be lost.
  - You are about to alter the column `subtotal` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `tax` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `total` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to drop the column `compareAtPrice` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `isAvailable` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `stockQuantity` on the `products` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `products` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `carts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wishlist_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wishlists` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,productId]` on the table `cart_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[styleCode]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `cart_items` table without a default value. This is not possible if the table is not empty.
  - Made the column `platform` on table `fcm_tokens` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `paymentMethod` on the `orders` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `careInstructions` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dimensions` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `styleCode` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'RAZORPAY', 'DODO');

-- DropForeignKey
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_cartId_fkey";

-- DropForeignKey
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_productId_fkey";

-- DropForeignKey
ALTER TABLE "carts" DROP CONSTRAINT "carts_userId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_userId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_orderId_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "wishlist_items" DROP CONSTRAINT "wishlist_items_productId_fkey";

-- DropForeignKey
ALTER TABLE "wishlist_items" DROP CONSTRAINT "wishlist_items_wishlistId_fkey";

-- DropForeignKey
ALTER TABLE "wishlists" DROP CONSTRAINT "wishlists_userId_fkey";

-- DropIndex
DROP INDEX "cart_items_cartId_productId_key";

-- DropIndex
DROP INDEX "categories_slug_idx";

-- DropIndex
DROP INDEX "order_status_history_createdAt_idx";

-- DropIndex
DROP INDEX "orders_orderNumber_idx";

-- DropIndex
DROP INDEX "products_slug_idx";

-- DropIndex
DROP INDEX "products_slug_key";

-- DropIndex
DROP INDEX "users_email_idx";

-- AlterTable
ALTER TABLE "addresses" ALTER COLUMN "country" SET DEFAULT 'USA';

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN "userId" TEXT;

-- Populate userId from carts table
UPDATE "cart_items" SET "userId" = (
  SELECT "userId" FROM "carts" WHERE "carts"."id" = "cart_items"."cartId"
);

-- Set userId as NOT NULL after population
ALTER TABLE "cart_items" ALTER COLUMN "userId" SET NOT NULL;

-- Drop cartId column
ALTER TABLE "cart_items" DROP COLUMN "cartId";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "isActive",
ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "fcm_tokens" ALTER COLUMN "platform" SET NOT NULL;

-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "shipping",
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "paymentIntentId" TEXT,
ADD COLUMN     "razorpayOrderId" TEXT,
ADD COLUMN     "razorpayPaymentId" TEXT,
ADD COLUMN     "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "trackingNumber" TEXT,
ADD COLUMN     "userEmail" TEXT,
ADD COLUMN     "userName" TEXT,
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "tax" SET DEFAULT 0,
ALTER COLUMN "tax" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(10,2),
ADD COLUMN     "paymentMethod_new" "PaymentMethod";

-- Populate audit snapshot fields from users table to preserve order attribution
UPDATE "orders" 
SET "userEmail" = u."email", 
    "userName" = CONCAT(u."firstName", ' ', u."lastName")
FROM "users" u
WHERE "orders"."userId" = u."id";

-- Populate paymentMethod_new by mapping existing values
UPDATE "orders" SET "paymentMethod_new" = CASE
  WHEN "paymentMethod" = 'STRIPE' THEN 'STRIPE'::text::"PaymentMethod"
  WHEN "paymentMethod" = 'RAZORPAY' THEN 'RAZORPAY'::text::"PaymentMethod"
  WHEN "paymentMethod" = 'DODO' THEN 'DODO'::text::"PaymentMethod"
  ELSE 'STRIPE'::text::"PaymentMethod"
END;

-- Set the new column as NOT NULL
ALTER TABLE "orders" ALTER COLUMN "paymentMethod_new" SET NOT NULL;

-- Drop old column and rename new one
ALTER TABLE "orders" DROP COLUMN "paymentMethod";
ALTER TABLE "orders" RENAME COLUMN "paymentMethod_new" TO "paymentMethod";

-- AlterTable - Add new columns (nullable initially for safe migration)
ALTER TABLE "products" DROP COLUMN "compareAtPrice",
DROP COLUMN "isAvailable",
DROP COLUMN "slug",
DROP COLUMN "stockQuantity",
ADD COLUMN     "careInstructions" TEXT,
ADD COLUMN     "dimensions" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "materials" TEXT[],
ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "styleCode" TEXT,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2);

-- Backfill careInstructions and dimensions with empty string for existing rows
UPDATE "products" SET "careInstructions" = '' WHERE "careInstructions" IS NULL;
UPDATE "products" SET "dimensions" = '' WHERE "dimensions" IS NULL;

-- Backfill styleCode with a generated value (id-based) for existing rows to ensure uniqueness
UPDATE "products" SET "styleCode" = "id" WHERE "styleCode" IS NULL;

-- Set careInstructions, dimensions, and styleCode as NOT NULL after backfill
ALTER TABLE "products" ALTER COLUMN "careInstructions" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "dimensions" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "styleCode" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'CUSTOMER';

-- ====== DATA MIGRATION & ARCHIVAL ======

-- Create archival table for payments to preserve transaction history
CREATE TABLE "payment_history" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id")
);

-- Create indexes on archived payment data
CREATE INDEX "payment_history_orderId_idx" ON "payment_history"("orderId");
CREATE INDEX "payment_history_providerPaymentId_idx" ON "payment_history"("providerPaymentId");
CREATE INDEX "payment_history_createdAt_idx" ON "payment_history"("createdAt");

-- Archive all payments before dropping the table
INSERT INTO "payment_history" ("id", "orderId", "amount", "currency", "provider", "providerPaymentId", "providerTransactionId", "status", "paidAt", "createdAt", "updatedAt")
SELECT "id", "orderId", "amount", "currency", "provider", "providerPaymentId", "providerTransactionId", "status"::"text", "paidAt", "createdAt", "updatedAt"
FROM "payments";

-- Verify archival integrity: ensure all payments were copied
DO $$
DECLARE
  orig_count BIGINT;
  archived_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO orig_count FROM "payments";
  SELECT COUNT(*) INTO archived_count FROM "payment_history";
  IF orig_count != archived_count THEN
    RAISE EXCEPTION 'Payment archival failed: original % records, archived % records', orig_count, archived_count;
  END IF;
END $$;

-- ====== DROP TABLES ======

-- DropTable
DROP TABLE "carts";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "payments";

-- DropTable
DROP TABLE "wishlist_items";

-- DropTable
DROP TABLE "wishlists";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "wishlist_userId_productId_key" ON "wishlist"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_revocations_tokenHash_key" ON "refresh_token_revocations"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_token_revocations_userId_idx" ON "refresh_token_revocations"("userId");

-- CreateIndex
CREATE INDEX "refresh_token_revocations_revokedAt_idx" ON "refresh_token_revocations"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_userId_productId_key" ON "cart_items"("userId", "productId");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "products_styleCode_key" ON "products"("styleCode");

-- CreateIndex
CREATE INDEX "products_isActive_idx" ON "products"("isActive");

-- CreateIndex
CREATE INDEX "products_isFeatured_idx" ON "products"("isFeatured");

-- CreateIndex
CREATE INDEX "products_categoryId_isActive_idx" ON "products"("categoryId", "isActive");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
