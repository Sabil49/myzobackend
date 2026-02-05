/*
  Warnings:

  - You are about to drop the column `userId` on the `cart_items` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `categories` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `order_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to drop the column `carrier` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `paymentIntentId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `razorpayOrderId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `razorpayPaymentId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `shippingCost` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `trackingNumber` on the `orders` table. All the data in the column will be lost.
  - You are about to alter the column `subtotal` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `tax` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - You are about to alter the column `total` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - The `paymentMethod` column on the `orders` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `careInstructions` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `dimensions` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `isWishlisted` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `materials` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `styleCode` on the `products` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `DoublePrecision`.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `fcm_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_status_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `refresh_token_revocations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `wishlist` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[cartId,productId]` on the table `cart_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cartId` to the `cart_items` table without a default value. This is not possible if the table is not empty.
  - Made the column `userId` on table `orders` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');

-- DropForeignKey
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_productId_fkey";

-- DropForeignKey
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_userId_fkey";

-- DropForeignKey
ALTER TABLE "fcm_tokens" DROP CONSTRAINT "fcm_tokens_userId_fkey";

-- DropForeignKey
ALTER TABLE "order_status_history" DROP CONSTRAINT "order_status_history_orderId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_userId_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "wishlist" DROP CONSTRAINT "wishlist_productId_fkey";

-- DropForeignKey
ALTER TABLE "wishlist" DROP CONSTRAINT "wishlist_userId_fkey";

-- DropIndex
DROP INDEX "cart_items_userId_productId_key";

-- DropIndex
DROP INDEX "order_items_orderId_idx";

-- DropIndex
DROP INDEX "orders_status_idx";

-- DropIndex
DROP INDEX "products_categoryId_isActive_idx";

-- DropIndex
DROP INDEX "products_isActive_idx";

-- DropIndex
DROP INDEX "products_isFeatured_idx";

-- DropIndex
DROP INDEX "products_styleCode_key";

-- AlterTable
ALTER TABLE "addresses" ALTER COLUMN "country" SET DEFAULT 'US';

-- AlterTable
ALTER TABLE "cart_items" DROP COLUMN "userId",
ADD COLUMN     "cartId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "imageUrl",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "carrier",
DROP COLUMN "paymentIntentId",
DROP COLUMN "razorpayOrderId",
DROP COLUMN "razorpayPaymentId",
DROP COLUMN "shippingCost",
DROP COLUMN "trackingNumber",
ADD COLUMN     "shipping" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "subtotal" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "tax" DROP DEFAULT,
ALTER COLUMN "tax" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "total" SET DATA TYPE DOUBLE PRECISION,
DROP COLUMN "paymentMethod",
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'CARD';

-- AlterTable
ALTER TABLE "products" DROP COLUMN "careInstructions",
DROP COLUMN "dimensions",
DROP COLUMN "isActive",
DROP COLUMN "isWishlisted",
DROP COLUMN "materials",
DROP COLUMN "stock",
DROP COLUMN "styleCode",
ADD COLUMN     "compareAtPrice" DOUBLE PRECISION,
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "stockQuantity" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "fcmToken" TEXT,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER';

-- DropTable
DROP TABLE "fcm_tokens";

-- DropTable
DROP TABLE "order_status_history";

-- DropTable
DROP TABLE "refresh_token_revocations";

-- DropTable
DROP TABLE "wishlist";

-- DropEnum
DROP TYPE "PaymentMethod";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carts_userId_key" ON "carts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_userId_key" ON "wishlists"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_wishlistId_productId_key" ON "wishlist_items"("wishlistId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerPaymentId_key" ON "payments"("providerPaymentId");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_providerPaymentId_idx" ON "payments"("providerPaymentId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_productId_key" ON "cart_items"("cartId", "productId");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "orders_orderNumber_idx" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_slug_idx" ON "products"("slug");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
