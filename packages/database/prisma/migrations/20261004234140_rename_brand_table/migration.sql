ALTER TABLE "Brand" RENAME TO "brand";
ALTER TABLE "brand" RENAME CONSTRAINT "Brand_pkey" TO "brand_pkey";
ALTER INDEX "Brand_name_key" RENAME TO "brand_name_key";
ALTER INDEX "Brand_slug_key" RENAME TO "brand_slug_key";