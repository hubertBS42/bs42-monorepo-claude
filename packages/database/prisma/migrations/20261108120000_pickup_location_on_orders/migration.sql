-- AlterTable
ALTER TABLE "order" ADD COLUMN     "pickupLocationId" UUID;

-- AlterTable
ALTER TABLE "quote" ADD COLUMN     "pickupLocationId" UUID;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "pickup_location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "pickup_location"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Pickup orders made so far were collected at their store's location
UPDATE "order" ord
SET "pickupLocationId" = p."id"
FROM "pickup_location" p
WHERE ord."shippingMethod" = 'PICKUP'
  AND ord."pickupAddress" IS NOT NULL
  AND p."organizationId" = (SELECT oi."organizationId" FROM "order_item" oi WHERE oi."orderId" = ord."id" LIMIT 1);

-- CreateIndex
CREATE INDEX "order_pickupLocationId_idx" ON "order"("pickupLocationId");

-- CreateIndex
CREATE INDEX "quote_pickupLocationId_idx" ON "quote"("pickupLocationId");
