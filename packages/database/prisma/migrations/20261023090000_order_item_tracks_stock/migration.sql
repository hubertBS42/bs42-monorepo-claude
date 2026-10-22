-- Each order line remembers whether its sale took stock (the row tracked it then), so a cancellation or a return puts
-- back exactly what was taken even if the listing's tracking has changed since.
ALTER TABLE "order_item" ADD COLUMN "tracksStock" BOOLEAN;

-- Existing lines: the best record of what happened is how their row tracks stock now
UPDATE "order_item" AS item
SET "tracksStock" = COALESCE(
  (SELECT variant."trackInventory" FROM "store_listing_variant" AS variant WHERE variant."id" = item."storeListingVariantId"),
  (SELECT listing."trackInventory" FROM "store_listing" AS listing WHERE listing."id" = item."storeListingId")
);

ALTER TABLE "order_item" ALTER COLUMN "tracksStock" SET NOT NULL;
