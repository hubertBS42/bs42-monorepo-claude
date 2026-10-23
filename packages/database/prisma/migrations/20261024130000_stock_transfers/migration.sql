
-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('SENT', 'RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'TRANSFER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementReason" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "StockMovementReason" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "StockMovementReason" ADD VALUE 'TRANSFER_CANCELLED';

-- AlterTable
ALTER TABLE "stock_movement" ADD COLUMN     "stockTransferId" UUID;

-- CreateTable
CREATE TABLE "stock_transfer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference" TEXT NOT NULL,
    "fromStoreId" UUID NOT NULL,
    "toStoreId" UUID NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'SENT',
    "notes" TEXT,
    "sentById" UUID,
    "receivedById" UUID,
    "receivedAt" TIMESTAMP(3),
    "receiveNote" TEXT,
    "cancelledById" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transferId" UUID NOT NULL,
    "fromListingId" UUID NOT NULL,
    "fromListingVariantId" UUID,
    "toListingId" UUID NOT NULL,
    "toListingVariantId" UUID,
    "productName" TEXT NOT NULL,
    "variantDescription" TEXT,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "quantityReceived" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stock_transfer_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfer_reference_key" ON "stock_transfer"("reference");

-- CreateIndex
CREATE INDEX "stock_transfer_fromStoreId_createdAt_idx" ON "stock_transfer"("fromStoreId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_transfer_toStoreId_createdAt_idx" ON "stock_transfer"("toStoreId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_transfer_item_transferId_idx" ON "stock_transfer_item"("transferId");

-- CreateIndex
CREATE INDEX "stock_transfer_item_fromListingId_idx" ON "stock_transfer_item"("fromListingId");

-- CreateIndex
CREATE INDEX "stock_transfer_item_fromListingVariantId_idx" ON "stock_transfer_item"("fromListingVariantId");

-- CreateIndex
CREATE INDEX "stock_transfer_item_toListingId_idx" ON "stock_transfer_item"("toListingId");

-- CreateIndex
CREATE INDEX "stock_transfer_item_toListingVariantId_idx" ON "stock_transfer_item"("toListingVariantId");

-- CreateIndex
CREATE INDEX "stock_movement_stockTransferId_idx" ON "stock_movement"("stockTransferId");

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "stock_transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_toStoreId_fkey" FOREIGN KEY ("toStoreId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_fromListingId_fkey" FOREIGN KEY ("fromListingId") REFERENCES "store_listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_fromListingVariantId_fkey" FOREIGN KEY ("fromListingVariantId") REFERENCES "store_listing_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_toListingId_fkey" FOREIGN KEY ("toListingId") REFERENCES "store_listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_toListingVariantId_fkey" FOREIGN KEY ("toListingVariantId") REFERENCES "store_listing_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- TR-20261024-00001: numbered by this sequence, so two transfers sent at once never share one; gaps are expected
CREATE SEQUENCE "stock_transfer_reference_seq" AS BIGINT START 1;

-- A transfer moves at least one unit per line, and receives no more than was sent
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_quantity" CHECK ("quantity" > 0);
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_received" CHECK ("quantityReceived" IS NULL OR ("quantityReceived" >= 0 AND "quantityReceived" <= "quantity"));
-- Between two different stores
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_two_stores" CHECK ("fromStoreId" <> "toStoreId");
