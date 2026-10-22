
-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('OPEN', 'ACCEPTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "notifyQuotes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quoteValidityDays" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "quote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference" TEXT NOT NULL,
    "userId" UUID,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "shippingLine1" TEXT NOT NULL,
    "shippingLine2" TEXT,
    "shippingRegion" TEXT NOT NULL,
    "shippingTown" TEXT NOT NULL,
    "tradeAccountId" UUID,
    "tradeCompanyName" TEXT,
    "tradeTin" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'OPEN',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "subtotalUsd" DECIMAL(12,2) NOT NULL,
    "subtotalGhs" DECIMAL(12,2) NOT NULL,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(12,2),
    "discountAmountGhs" DECIMAL(12,2),
    "discountReason" TEXT,
    "shippingGhs" DECIMAL(12,2) NOT NULL,
    "installationGhs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,4) NOT NULL,
    "taxGhs" DECIMAL(12,2) NOT NULL,
    "totalGhs" DECIMAL(12,2) NOT NULL,
    "exchangeRate" DECIMAL(12,6) NOT NULL,
    "exchangeRateId" UUID,
    "orderId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quoteId" UUID NOT NULL,
    "organizationId" UUID,
    "storeListingId" UUID,
    "storeListingVariantId" UUID,
    "productId" UUID,
    "productVariantId" UUID,
    "hasVariant" BOOLEAN NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceUsd" DECIMAL(12,2) NOT NULL,
    "totalPriceUsd" DECIMAL(12,2) NOT NULL,
    "unitPriceGhs" DECIMAL(12,2) NOT NULL,
    "totalPriceGhs" DECIMAL(12,2) NOT NULL,
    "discountGhs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxGhs" DECIMAL(12,2) NOT NULL,
    "installationUnitGhs" DECIMAL(12,2),
    "installationTotalGhs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "installationTaxGhs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "productName" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "productImage" TEXT,
    "variantDescription" TEXT,
    "sku" TEXT,
    "storeName" TEXT NOT NULL,

    CONSTRAINT "quote_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quote_reference_key" ON "quote"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "quote_orderId_key" ON "quote"("orderId");

-- CreateIndex
CREATE INDEX "quote_userId_idx" ON "quote"("userId");

-- CreateIndex
CREATE INDEX "quote_status_idx" ON "quote"("status");

-- CreateIndex
CREATE INDEX "quote_tradeAccountId_idx" ON "quote"("tradeAccountId");

-- CreateIndex
CREATE INDEX "quote_exchangeRateId_idx" ON "quote"("exchangeRateId");

-- CreateIndex
CREATE INDEX "quote_item_quoteId_idx" ON "quote_item"("quoteId");

-- CreateIndex
CREATE INDEX "quote_item_organizationId_idx" ON "quote_item"("organizationId");

-- CreateIndex
CREATE INDEX "quote_item_storeListingId_idx" ON "quote_item"("storeListingId");

-- CreateIndex
CREATE INDEX "quote_item_storeListingVariantId_idx" ON "quote_item"("storeListingVariantId");

-- CreateIndex
CREATE INDEX "quote_item_productId_idx" ON "quote_item"("productId");

-- CreateIndex
CREATE INDEX "quote_item_productVariantId_idx" ON "quote_item"("productVariantId");

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_tradeAccountId_fkey" FOREIGN KEY ("tradeAccountId") REFERENCES "trade_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_exchangeRateId_fkey" FOREIGN KEY ("exchangeRateId") REFERENCES "exchange_rate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_storeListingId_fkey" FOREIGN KEY ("storeListingId") REFERENCES "store_listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_storeListingVariantId_fkey" FOREIGN KEY ("storeListingVariantId") REFERENCES "store_listing_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Numbers quotation references (QT-20261022-00012), like order_reference_seq. Prisma doesn't model sequences.
CREATE SEQUENCE "quote_reference_seq" AS BIGINT START 1;

-- Prisma doesn't model CHECK constraints, so they live here.
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "quote" ADD CONSTRAINT "quote_amounts_not_negative" CHECK ("totalGhs" >= 0 AND "shippingGhs" >= 0 AND "installationGhs" >= 0 AND "taxGhs" >= 0);
-- An accepted quote names its order (until that order were ever deleted, which orders aren't)
ALTER TABLE "quote" ADD CONSTRAINT "quote_accepted_order" CHECK ("status" <> 'ACCEPTED' OR "orderId" IS NOT NULL);
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_quote_validity" CHECK ("quoteValidityDays" BETWEEN 1 AND 90);
