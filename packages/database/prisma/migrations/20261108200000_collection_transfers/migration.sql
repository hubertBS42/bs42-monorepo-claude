-- CreateEnum
CREATE TYPE "CollectionTransferStatus" AS ENUM ('SENT', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "order_item" ADD COLUMN     "heldListingId" UUID,
ADD COLUMN     "heldListingVariantId" UUID;

-- CreateTable
CREATE TABLE "collection_transfer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "fromStoreId" UUID NOT NULL,
    "status" "CollectionTransferStatus" NOT NULL DEFAULT 'SENT',
    "sentById" UUID,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" UUID,
    "receivedAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "collection_transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collection_transfer_orderId_idx" ON "collection_transfer"("orderId");

-- CreateIndex
CREATE INDEX "collection_transfer_fromStoreId_idx" ON "collection_transfer"("fromStoreId");

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_heldListingId_fkey" FOREIGN KEY ("heldListingId") REFERENCES "store_listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_heldListingVariantId_fkey" FOREIGN KEY ("heldListingVariantId") REFERENCES "store_listing_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_transfer" ADD CONSTRAINT "collection_transfer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_transfer" ADD CONSTRAINT "collection_transfer_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_transfer" ADD CONSTRAINT "collection_transfer_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_transfer" ADD CONSTRAINT "collection_transfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_transfer" ADD CONSTRAINT "collection_transfer_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateIndex
CREATE INDEX "order_item_heldListingId_idx" ON "order_item"("heldListingId");

-- CreateIndex
CREATE INDEX "order_item_heldListingVariantId_idx" ON "order_item"("heldListingVariantId");
