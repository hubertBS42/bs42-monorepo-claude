-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN');

-- DropForeignKey
ALTER TABLE "review" DROP CONSTRAINT "review_storeListingId_fkey";

-- DropIndex
DROP INDEX "review_productId_idx";

-- DropIndex
DROP INDEX "review_storeListingId_idx";

-- DropIndex
DROP INDEX "review_userId_productId_storeListingId_key";

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "notifyLowRatings" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "review" DROP COLUMN "description",
DROP COLUMN "isVerifiedPurchase",
DROP COLUMN "storeListingId",
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenById" UUID,
ADD COLUMN     "hiddenReason" TEXT,
ADD COLUMN     "orderItemId" UUID,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "variantLabel" TEXT;

-- CreateIndex
CREATE INDEX "review_productId_status_idx" ON "review"("productId", "status");

-- CreateIndex
CREATE INDEX "review_status_createdAt_idx" ON "review"("status", "createdAt");

-- CreateIndex
CREATE INDEX "review_orderItemId_idx" ON "review"("orderItemId");

-- CreateIndex
CREATE INDEX "review_hiddenById_idx" ON "review"("hiddenById");

-- CreateIndex
CREATE UNIQUE INDEX "review_userId_productId_key" ON "review"("userId", "productId");

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A hidden review keeps the reason the customer is shown (the rating check from the first migration stays)
ALTER TABLE "review" ADD CONSTRAINT "review_hidden_reason_check" CHECK ("status" = 'PUBLISHED' OR "hiddenReason" IS NOT NULL);
