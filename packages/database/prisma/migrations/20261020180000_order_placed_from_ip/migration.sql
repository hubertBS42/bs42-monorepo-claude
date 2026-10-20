-- AlterTable
ALTER TABLE "order" ADD COLUMN     "placedFromIp" TEXT;

-- CreateIndex
CREATE INDEX "order_placedFromIp_idx" ON "order"("placedFromIp");

