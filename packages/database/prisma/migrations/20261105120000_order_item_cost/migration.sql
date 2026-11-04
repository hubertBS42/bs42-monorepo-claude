-- AlterTable
ALTER TABLE "order_item" ADD COLUMN     "costEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unitCostUsd" DECIMAL(12,2);

-- Lines sold before costs were recorded get an estimate: the buy price now, the variant's else the listing's, as a
-- sale records it from here on. A buy price of 0 or none leaves the line without a cost.
UPDATE "order_item" AS item
SET "unitCostUsd" = cost.value,
    "costEstimated" = true
FROM (
    SELECT line."id", COALESCE(NULLIF(variant."buyPrice", 0), NULLIF(listing."buyPrice", 0)) AS value
    FROM "order_item" AS line
    JOIN "store_listing" AS listing ON listing."id" = line."storeListingId"
    LEFT JOIN "store_listing_variant" AS variant ON variant."id" = line."storeListingVariantId"
) AS cost
WHERE cost."id" = item."id" AND cost.value IS NOT NULL;
