-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'BANK_TRANSFER';

-- AlterTable
ALTER TABLE "quote" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "notes" TEXT;

-- CreateIndex
CREATE INDEX "quote_createdById_idx" ON "quote"("createdById");

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
