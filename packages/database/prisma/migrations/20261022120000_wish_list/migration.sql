-- CreateTable
CREATE TABLE "wish_list_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wish_list_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wish_list_item_userId_createdAt_idx" ON "wish_list_item"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "wish_list_item_productId_idx" ON "wish_list_item"("productId");

-- CreateIndex
CREATE INDEX "wish_list_item_variantId_idx" ON "wish_list_item"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "wish_list_item_userId_productId_variantId_key" ON "wish_list_item"("userId", "productId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "wish_list_item_no_variant_key" ON "wish_list_item"("userId", "productId") WHERE ("variantId" IS NULL);

-- AddForeignKey
ALTER TABLE "wish_list_item" ADD CONSTRAINT "wish_list_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wish_list_item" ADD CONSTRAINT "wish_list_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wish_list_item" ADD CONSTRAINT "wish_list_item_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

