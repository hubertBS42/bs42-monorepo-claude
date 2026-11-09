-- AlterTable
ALTER TABLE "quote" ADD COLUMN     "organizationId" UUID;

-- CreateIndex
CREATE INDEX "quote_organizationId_idx" ON "quote"("organizationId");

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
