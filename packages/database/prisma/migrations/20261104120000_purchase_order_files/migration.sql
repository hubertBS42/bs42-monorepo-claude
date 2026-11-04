-- CreateTable
CREATE TABLE "purchase_order_file" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purchaseOrderId" UUID NOT NULL,
    "receiptId" UUID,
    "blobName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_file_blobName_key" ON "purchase_order_file"("blobName");

-- CreateIndex
CREATE INDEX "purchase_order_file_purchaseOrderId_createdAt_idx" ON "purchase_order_file"("purchaseOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_order_file_receiptId_idx" ON "purchase_order_file"("receiptId");

-- CreateIndex
CREATE INDEX "purchase_order_file_uploadedById_idx" ON "purchase_order_file"("uploadedById");

-- AddForeignKey
ALTER TABLE "purchase_order_file" ADD CONSTRAINT "purchase_order_file_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_file" ADD CONSTRAINT "purchase_order_file_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "purchase_order_receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_file" ADD CONSTRAINT "purchase_order_file_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Prisma doesn't model CHECK constraints
ALTER TABLE "purchase_order_file" ADD CONSTRAINT "purchase_order_file_size_check" CHECK ("size" > 0);
