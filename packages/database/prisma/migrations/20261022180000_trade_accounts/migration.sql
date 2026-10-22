
-- CreateEnum
CREATE TYPE "TradeAccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('INSTALLER', 'IT_CONTRACTOR', 'RESELLER', 'OTHER');

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "notifyTradeApplications" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "tradeAccountId" UUID,
ADD COLUMN     "tradeCompanyName" TEXT,
ADD COLUMN     "tradeTin" TEXT;

-- CreateTable
CREATE TABLE "trade_account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "companyName" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "tin" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "businessType" "BusinessType" NOT NULL,
    "details" TEXT,
    "status" "TradeAccountStatus" NOT NULL DEFAULT 'PENDING',
    "discountPercent" DECIMAL(5,2),
    "rejectionReason" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trade_account_userId_key" ON "trade_account"("userId");

-- CreateIndex
CREATE INDEX "trade_account_status_idx" ON "trade_account"("status");

-- CreateIndex
CREATE INDEX "trade_account_reviewedById_idx" ON "trade_account"("reviewedById");

-- CreateIndex
CREATE INDEX "order_tradeAccountId_idx" ON "order"("tradeAccountId");

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_tradeAccountId_fkey" FOREIGN KEY ("tradeAccountId") REFERENCES "trade_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_account" ADD CONSTRAINT "trade_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_account" ADD CONSTRAINT "trade_account_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Prisma doesn't model CHECK constraints, so they live here.
-- A discount is a percentage above 0 and below 100, held while the account is approved or suspended; a rejection
-- carries the reason the customer is shown
ALTER TABLE "trade_account" ADD CONSTRAINT "trade_account_discount" CHECK (
  ("discountPercent" IS NULL OR ("discountPercent" > 0 AND "discountPercent" < 100))
  AND ("status" NOT IN ('APPROVED', 'SUSPENDED') OR "discountPercent" IS NOT NULL)
);
ALTER TABLE "trade_account" ADD CONSTRAINT "trade_account_rejection_reason" CHECK ("status" <> 'REJECTED' OR "rejectionReason" IS NOT NULL);
