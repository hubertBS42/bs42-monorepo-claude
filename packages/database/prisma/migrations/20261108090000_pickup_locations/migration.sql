-- AlterTable
ALTER TABLE "order" ADD COLUMN     "pickupAddress" TEXT,
ADD COLUMN     "pickupHours" TEXT,
ADD COLUMN     "pickupMapUrl" TEXT,
ADD COLUMN     "pickupName" TEXT,
ADD COLUMN     "pickupPhone" TEXT;

-- CreateTable
CREATE TABLE "pickup_location" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "hours" TEXT,
    "phone" TEXT,
    "mapUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pickup_location_organizationId_key" ON "pickup_location"("organizationId");

-- AddForeignKey
ALTER TABLE "pickup_location" ADD CONSTRAINT "pickup_location_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- With one store, it's the business's one location: it gets Settings' contact address, hours, phone and map link as
-- its pickup location, named as the storefront is. With several, each store adds its own in Store Details.
INSERT INTO "pickup_location" ("organizationId", "name", "address", "hours", "phone", "mapUrl", "updatedAt")
SELECT o."id", COALESCE(NULLIF(s."storeName", ''), o."name"), s."contactAddress", s."contactHours", s."contactPhone", s."contactMapUrl", CURRENT_TIMESTAMP
FROM "organization" o
CROSS JOIN "app_settings" s
WHERE o."slug" <> 'global'
  AND s."id" = 'singleton'
  AND NULLIF(TRIM(s."contactAddress"), '') IS NOT NULL
  AND (SELECT COUNT(*) FROM "organization" WHERE "slug" <> 'global') = 1;

-- Pickup orders made so far keep that location, as new ones will
UPDATE "order" ord
SET "pickupName" = p."name", "pickupAddress" = p."address", "pickupHours" = p."hours", "pickupPhone" = p."phone", "pickupMapUrl" = p."mapUrl"
FROM "pickup_location" p
WHERE ord."shippingMethod" = 'PICKUP'
  AND p."organizationId" = (SELECT oi."organizationId" FROM "order_item" oi WHERE oi."orderId" = ord."id" LIMIT 1);
