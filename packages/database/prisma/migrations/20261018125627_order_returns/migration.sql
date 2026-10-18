-- CreateTable
CREATE TABLE "order_return" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "refundId" UUID,
    "recordedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_return_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "returnId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "restocked" BOOLEAN NOT NULL,

    CONSTRAINT "order_return_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_return_refundId_key" ON "order_return"("refundId");

-- CreateIndex
CREATE INDEX "order_return_orderId_idx" ON "order_return"("orderId");

-- CreateIndex
CREATE INDEX "order_return_recordedById_idx" ON "order_return"("recordedById");

-- CreateIndex
CREATE INDEX "order_return_item_orderItemId_idx" ON "order_return_item"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "order_return_item_returnId_orderItemId_key" ON "order_return_item"("returnId", "orderItemId");

-- AddForeignKey
ALTER TABLE "order_return" ADD CONSTRAINT "order_return_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return" ADD CONSTRAINT "order_return_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "order_refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return" ADD CONSTRAINT "order_return_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_item" ADD CONSTRAINT "order_return_item_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "order_return"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_item" ADD CONSTRAINT "order_return_item_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma doesn't model CHECK constraints. A return item brings back at least one unit; that a line's returns never
-- add up to more than it sold is checked by the return code, which locks the order row while it adds them up.
ALTER TABLE "order_return_item" ADD CONSTRAINT "order_return_item_quantity_check" CHECK ("quantity" > 0);
