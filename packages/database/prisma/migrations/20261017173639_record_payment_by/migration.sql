-- AlterTable
ALTER TABLE "order" ADD COLUMN     "paymentRecordedById" UUID;

-- CreateIndex
CREATE INDEX "order_paymentRecordedById_idx" ON "order"("paymentRecordedById");

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_paymentRecordedById_fkey" FOREIGN KEY ("paymentRecordedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
