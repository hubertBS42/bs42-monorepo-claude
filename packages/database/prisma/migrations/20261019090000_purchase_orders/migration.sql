-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'GHS');

-- CreateTable
CREATE TABLE "supplier" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" "Currency" NOT NULL,
    "exchangeRate" DECIMAL(12,6),
    "shippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedOn" DATE,
    "notes" TEXT,
    "createdById" UUID,
    "orderedAt" TIMESTAMP(3),
    "orderedById" UUID,
    "closedAt" TIMESTAMP(3),
    "closedById" UUID,
    "closeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseOrderId" UUID NOT NULL,
    "storeListingId" UUID NOT NULL,
    "storeListingVariantId" UUID,
    "productName" TEXT NOT NULL,
    "variantDescription" TEXT,
    "sku" TEXT,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "unitCostUsd" DECIMAL(12,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_receipt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseOrderId" UUID NOT NULL,
    "receivedById" UUID,
    "note" TEXT,
    "updatedBuyPrices" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_receipt_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receiptId" UUID NOT NULL,
    "purchaseOrderItemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "purchase_order_receipt_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_organizationId_name_key" ON "supplier"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_reference_key" ON "purchase_order"("reference");

-- CreateIndex
CREATE INDEX "purchase_order_organizationId_status_idx" ON "purchase_order"("organizationId", "status");

-- CreateIndex
CREATE INDEX "purchase_order_supplierId_idx" ON "purchase_order"("supplierId");

-- CreateIndex
CREATE INDEX "purchase_order_createdById_idx" ON "purchase_order"("createdById");

-- CreateIndex
CREATE INDEX "purchase_order_orderedById_idx" ON "purchase_order"("orderedById");

-- CreateIndex
CREATE INDEX "purchase_order_closedById_idx" ON "purchase_order"("closedById");

-- CreateIndex
CREATE INDEX "purchase_order_item_purchaseOrderId_idx" ON "purchase_order_item"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_item_storeListingId_idx" ON "purchase_order_item"("storeListingId");

-- CreateIndex
CREATE INDEX "purchase_order_item_storeListingVariantId_idx" ON "purchase_order_item"("storeListingVariantId");

-- CreateIndex
CREATE INDEX "purchase_order_receipt_purchaseOrderId_idx" ON "purchase_order_receipt"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_receipt_receivedById_idx" ON "purchase_order_receipt"("receivedById");

-- CreateIndex
CREATE INDEX "purchase_order_receipt_item_purchaseOrderItemId_idx" ON "purchase_order_receipt_item"("purchaseOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_receipt_item_receiptId_purchaseOrderItemId_key" ON "purchase_order_receipt_item"("receiptId", "purchaseOrderItemId");

-- AddForeignKey
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_storeListingId_fkey" FOREIGN KEY ("storeListingId") REFERENCES "store_listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_storeListingVariantId_fkey" FOREIGN KEY ("storeListingVariantId") REFERENCES "store_listing_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_receipt" ADD CONSTRAINT "purchase_order_receipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_receipt" ADD CONSTRAINT "purchase_order_receipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_receipt_item" ADD CONSTRAINT "purchase_order_receipt_item_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "purchase_order_receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_receipt_item" ADD CONSTRAINT "purchase_order_receipt_item_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;




-- Numbers purchase order references (PO-20261019-00042), like order_reference_seq. Prisma doesn't model sequences.
CREATE SEQUENCE "purchase_order_reference_seq" AS BIGINT START 1;

-- Prisma doesn't model CHECK constraints. That a line never receives more than it ordered is also checked by the
-- receiving code, which locks the purchase order row while it adds a delivery.
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_shippingCost_check" CHECK ("shippingCost" >= 0);
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_exchangeRate_check" CHECK ("exchangeRate" > 0);
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_quantities_check" CHECK ("quantityOrdered" > 0 AND "quantityReceived" >= 0 AND "quantityReceived" <= "quantityOrdered");
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_cost_check" CHECK ("unitCost" >= 0 AND "unitCostUsd" >= 0);
ALTER TABLE "purchase_order_receipt_item" ADD CONSTRAINT "purchase_order_receipt_item_quantity_check" CHECK ("quantity" > 0);
