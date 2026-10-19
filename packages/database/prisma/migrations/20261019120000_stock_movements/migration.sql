-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('INITIAL', 'SALE', 'CANCELLATION', 'RETURN', 'PURCHASE_RECEIVED', 'COUNT_CORRECTION', 'DAMAGED', 'LOST', 'OTHER');

-- CreateTable
CREATE TABLE "stock_movement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeListingId" UUID NOT NULL,
    "storeListingVariantId" UUID,
    "change" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "note" TEXT,
    "orderId" UUID,
    "orderReturnId" UUID,
    "purchaseOrderReceiptId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movement_storeListingId_createdAt_idx" ON "stock_movement"("storeListingId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movement_storeListingVariantId_idx" ON "stock_movement"("storeListingVariantId");

-- CreateIndex
CREATE INDEX "stock_movement_orderId_idx" ON "stock_movement"("orderId");

-- CreateIndex
CREATE INDEX "stock_movement_orderReturnId_idx" ON "stock_movement"("orderReturnId");

-- CreateIndex
CREATE INDEX "stock_movement_purchaseOrderReceiptId_idx" ON "stock_movement"("purchaseOrderReceiptId");

-- CreateIndex
CREATE INDEX "stock_movement_createdById_idx" ON "stock_movement"("createdById");

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_storeListingId_fkey" FOREIGN KEY ("storeListingId") REFERENCES "store_listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_storeListingVariantId_fkey" FOREIGN KEY ("storeListingVariantId") REFERENCES "store_listing_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_orderReturnId_fkey" FOREIGN KEY ("orderReturnId") REFERENCES "order_return"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_purchaseOrderReceiptId_fkey" FOREIGN KEY ("purchaseOrderReceiptId") REFERENCES "purchase_order_receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Prisma doesn't model CHECK constraints. A movement always changes something, and stock never goes below 0 (as the
-- listing and variant stock checks say).
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_change_check" CHECK ("change" <> 0);
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_stock_after_check" CHECK ("stockAfter" >= 0);
