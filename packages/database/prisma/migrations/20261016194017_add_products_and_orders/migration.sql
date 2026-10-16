-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('NEW', 'REFURBISHED', 'USED_LIKE_NEW', 'USED_GOOD', 'USED_FAIR');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ShippingMethod" AS ENUM ('DELIVERY', 'PICKUP');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "taxShipping" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "exchange_rate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "rate" DECIMAL(12,6) NOT NULL,
    "date" DATE NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandId" UUID NOT NULL,
    "baseSellPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "baseBuyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sku" TEXT,
    "barcode" TEXT,
    "weight" DECIMAL(12,2),
    "dimensions" TEXT,
    "categoryId" UUID NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'DRAFT',
    "condition" "Condition" NOT NULL DEFAULT 'NEW',
    "description" TEXT,
    "images" TEXT[],
    "rating" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "numReviews" INTEGER NOT NULL DEFAULT 0,
    "banner" TEXT,
    "tags" TEXT[],
    "hasVariants" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_option" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variant_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_option_value" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "optionId" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variant_option_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "images" TEXT[],
    "weight" DECIMAL(12,2),
    "dimensions" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant_value" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variantId" UUID NOT NULL,
    "optionValueId" UUID NOT NULL,

    CONSTRAINT "product_variant_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_listing" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "sellPrice" DECIMAL(12,2) NOT NULL,
    "buyPrice" DECIMAL(12,2),
    "compareAtPrice" DECIMAL(12,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'DRAFT',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_listing_variant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeListingId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "buyPrice" DECIMAL(12,2),
    "sellPrice" DECIMAL(12,2),
    "compareAtPrice" DECIMAL(12,2),
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_listing_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "sessionCartId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cartId" UUID NOT NULL,
    "storeListingId" UUID NOT NULL,
    "storeListingVariantId" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_sequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "shippingMethod" "ShippingMethod" NOT NULL DEFAULT 'DELIVERY',
    "shippingName" TEXT,
    "shippingPhone" TEXT,
    "shippingLine1" TEXT,
    "shippingLine2" TEXT,
    "shippingRegion" TEXT,
    "shippingTown" TEXT,
    "shippingLat" DOUBLE PRECISION,
    "shippingLng" DOUBLE PRECISION,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotalUsd" DECIMAL(12,2) NOT NULL,
    "subtotalGhs" DECIMAL(12,2) NOT NULL,
    "shippingGhs" DECIMAL(12,2) NOT NULL,
    "taxGhs" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,4) NOT NULL,
    "taxOverrideReason" TEXT,
    "totalGhs" DECIMAL(12,2) NOT NULL,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(12,2),
    "discountAmountGhs" DECIMAL(12,2),
    "discountReason" TEXT,
    "exchangeRate" DECIMAL(12,6) NOT NULL,
    "exchangeRateId" UUID,
    "createdById" UUID,
    "reference" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "changedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "storeListingId" UUID NOT NULL,
    "storeListingVariantId" UUID,
    "quantity" INTEGER NOT NULL,
    "unitPriceUsd" DECIMAL(12,2) NOT NULL,
    "totalPriceUsd" DECIMAL(12,2) NOT NULL,
    "unitPriceGhs" DECIMAL(12,2) NOT NULL,
    "totalPriceGhs" DECIMAL(12,2) NOT NULL,
    "discountGhs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxGhs" DECIMAL(12,2) NOT NULL,
    "productName" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "productImage" TEXT,
    "variantDescription" TEXT,
    "sku" TEXT,
    "storeName" TEXT NOT NULL,
    "productId" UUID,
    "productVariantId" UUID,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "storeListingId" UUID NOT NULL,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_from_to_date_key" ON "exchange_rate"("from", "to", "date");

-- CreateIndex
CREATE UNIQUE INDEX "product_slug_key" ON "product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_key" ON "product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_barcode_key" ON "product"("barcode");

-- CreateIndex
CREATE INDEX "product_brandId_idx" ON "product"("brandId");

-- CreateIndex
CREATE INDEX "product_categoryId_idx" ON "product"("categoryId");

-- CreateIndex
CREATE INDEX "product_document_productId_idx" ON "product_document"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "variant_option_productId_name_key" ON "variant_option"("productId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "variant_option_value_optionId_value_key" ON "variant_option_value"("optionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_sku_key" ON "product_variant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_barcode_key" ON "product_variant"("barcode");

-- CreateIndex
CREATE INDEX "product_variant_productId_idx" ON "product_variant"("productId");

-- CreateIndex
CREATE INDEX "product_variant_value_optionValueId_idx" ON "product_variant_value"("optionValueId");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_value_variantId_optionValueId_key" ON "product_variant_value"("variantId", "optionValueId");

-- CreateIndex
CREATE INDEX "store_listing_productId_idx" ON "store_listing"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "store_listing_organizationId_productId_key" ON "store_listing"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "store_listing_variant_variantId_idx" ON "store_listing_variant"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "store_listing_variant_storeListingId_variantId_key" ON "store_listing_variant"("storeListingId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_userId_key" ON "cart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_sessionCartId_key" ON "cart"("sessionCartId");

-- CreateIndex
CREATE INDEX "cart_item_storeListingId_idx" ON "cart_item"("storeListingId");

-- CreateIndex
CREATE INDEX "cart_item_storeListingVariantId_idx" ON "cart_item"("storeListingVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_item_cartId_storeListingId_storeListingVariantId_key" ON "cart_item"("cartId", "storeListingId", "storeListingVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_item_no_variant_key" ON "cart_item"("cartId", "storeListingId") WHERE ("storeListingVariantId" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "order_reference_key" ON "order"("reference");

-- CreateIndex
CREATE INDEX "order_userId_idx" ON "order"("userId");

-- CreateIndex
CREATE INDEX "order_createdById_idx" ON "order"("createdById");

-- CreateIndex
CREATE INDEX "order_exchangeRateId_idx" ON "order"("exchangeRateId");

-- CreateIndex
CREATE INDEX "order_status_idx" ON "order"("status");

-- CreateIndex
CREATE INDEX "order_status_history_orderId_idx" ON "order_status_history"("orderId");

-- CreateIndex
CREATE INDEX "order_status_history_changedById_idx" ON "order_status_history"("changedById");

-- CreateIndex
CREATE INDEX "order_item_orderId_idx" ON "order_item"("orderId");

-- CreateIndex
CREATE INDEX "order_item_organizationId_idx" ON "order_item"("organizationId");

-- CreateIndex
CREATE INDEX "order_item_storeListingId_idx" ON "order_item"("storeListingId");

-- CreateIndex
CREATE INDEX "order_item_storeListingVariantId_idx" ON "order_item"("storeListingVariantId");

-- CreateIndex
CREATE INDEX "order_item_productId_idx" ON "order_item"("productId");

-- CreateIndex
CREATE INDEX "order_item_productVariantId_idx" ON "order_item"("productVariantId");

-- CreateIndex
CREATE INDEX "review_productId_idx" ON "review"("productId");

-- CreateIndex
CREATE INDEX "review_storeListingId_idx" ON "review"("storeListingId");

-- CreateIndex
CREATE UNIQUE INDEX "review_userId_productId_storeListingId_key" ON "review"("userId", "productId", "storeListingId");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_document" ADD CONSTRAINT "product_document_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option" ADD CONSTRAINT "variant_option_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_value" ADD CONSTRAINT "variant_option_value_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "variant_option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_value" ADD CONSTRAINT "product_variant_value_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_value" ADD CONSTRAINT "product_variant_value_optionValueId_fkey" FOREIGN KEY ("optionValueId") REFERENCES "variant_option_value"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_listing" ADD CONSTRAINT "store_listing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_listing" ADD CONSTRAINT "store_listing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_listing_variant" ADD CONSTRAINT "store_listing_variant_storeListingId_fkey" FOREIGN KEY ("storeListingId") REFERENCES "store_listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_listing_variant" ADD CONSTRAINT "store_listing_variant_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart" ADD CONSTRAINT "cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_storeListingId_fkey" FOREIGN KEY ("storeListingId") REFERENCES "store_listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_storeListingVariantId_fkey" FOREIGN KEY ("storeListingVariantId") REFERENCES "store_listing_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_exchangeRateId_fkey" FOREIGN KEY ("exchangeRateId") REFERENCES "exchange_rate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_storeListingId_fkey" FOREIGN KEY ("storeListingId") REFERENCES "store_listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_storeListingVariantId_fkey" FOREIGN KEY ("storeListingVariantId") REFERENCES "store_listing_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_storeListingId_fkey" FOREIGN KEY ("storeListingId") REFERENCES "store_listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check constraints. Prisma doesn't model these, so they live only in the migration.

-- Stock and thresholds can't go negative. Decrement stock in the update itself
-- (stock: { decrement: qty } with where: { stock: { gte: qty } }) so concurrent orders can't oversell.
ALTER TABLE "store_listing" ADD CONSTRAINT "store_listing_stock_check" CHECK ("stock" >= 0);
ALTER TABLE "store_listing" ADD CONSTRAINT "store_listing_low_stock_threshold_check" CHECK ("lowStockThreshold" >= 0);
ALTER TABLE "store_listing_variant" ADD CONSTRAINT "store_listing_variant_stock_check" CHECK ("stock" >= 0);
ALTER TABLE "store_listing_variant" ADD CONSTRAINT "store_listing_variant_low_stock_threshold_check" CHECK ("lowStockThreshold" >= 0);

-- A cart or order line always holds at least one item
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_quantity_check" CHECK ("quantity" > 0);

-- Star ratings
ALTER TABLE "review" ADD CONSTRAINT "review_rating_check" CHECK ("rating" BETWEEN 1 AND 5);

-- Tax rates are fractions: 0.15 is 15%
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_tax_rate_check" CHECK ("taxRate" >= 0 AND "taxRate" <= 1);
ALTER TABLE "order" ADD CONSTRAINT "order_tax_rate_check" CHECK ("taxRate" >= 0 AND "taxRate" <= 1);
