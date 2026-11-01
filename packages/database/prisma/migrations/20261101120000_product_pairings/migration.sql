-- "Pairs well with": products that go with a category's products or with one product

-- CreateTable
CREATE TABLE "product_pairing" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "categoryId" UUID,
    "productId" UUID,
    "pairedProductId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_pairing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_pairing_pairedProductId_idx" ON "product_pairing"("pairedProductId");

-- CreateIndex
CREATE UNIQUE INDEX "product_pairing_categoryId_pairedProductId_key" ON "product_pairing"("categoryId", "pairedProductId");

-- CreateIndex
CREATE UNIQUE INDEX "product_pairing_productId_pairedProductId_key" ON "product_pairing"("productId", "pairedProductId");

-- AddForeignKey
ALTER TABLE "product_pairing" ADD CONSTRAINT "product_pairing_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_pairing" ADD CONSTRAINT "product_pairing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_pairing" ADD CONSTRAINT "product_pairing_pairedProductId_fkey" FOREIGN KEY ("pairedProductId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A list belongs to a category or to a product, never both or neither
ALTER TABLE "product_pairing" ADD CONSTRAINT "product_pairing_one_source" CHECK (num_nonnulls("categoryId", "productId") = 1);

-- A product doesn't pair with itself
ALTER TABLE "product_pairing" ADD CONSTRAINT "product_pairing_not_itself" CHECK ("productId" IS NULL OR "productId" <> "pairedProductId");
