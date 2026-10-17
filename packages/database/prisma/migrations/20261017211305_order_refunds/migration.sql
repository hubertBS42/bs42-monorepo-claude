-- CreateTable
CREATE TABLE "order_refund" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "amountGhs" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reason" TEXT NOT NULL,
    "refundedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_refund_orderId_idx" ON "order_refund"("orderId");

-- CreateIndex
CREATE INDEX "order_refund_refundedById_idx" ON "order_refund"("refundedById");

-- AddForeignKey
ALTER TABLE "order_refund" ADD CONSTRAINT "order_refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_refund" ADD CONSTRAINT "order_refund_refundedById_fkey" FOREIGN KEY ("refundedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma doesn't model CHECK constraints. A refund gives some money back; the total refunded is checked by the
-- refund code, which locks the order row while it adds up earlier refunds.
ALTER TABLE "order_refund" ADD CONSTRAINT "order_refund_amount_check" CHECK ("amountGhs" > 0);
