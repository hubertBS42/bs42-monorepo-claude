
-- CreateEnum
CREATE TYPE "InstallationOption" AS ENUM ('CATEGORY', 'OWN', 'NONE');

-- CreateEnum
CREATE TYPE "InstallationStatus" AS ENUM ('TO_ARRANGE', 'BOOKED', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "cart_item" ADD COLUMN     "withInstallation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "category" ADD COLUMN     "installationFeeGhs" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "installationDate" DATE,
ADD COLUMN     "installationGhs" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "installationStatus" "InstallationStatus";

-- AlterTable
ALTER TABLE "order_item" ADD COLUMN     "installationTaxGhs" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "installationTotalGhs" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "installationUnitGhs" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "product" ADD COLUMN     "installation" "InstallationOption" NOT NULL DEFAULT 'CATEGORY',
ADD COLUMN     "installationFeeGhs" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "installation_area" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region" TEXT NOT NULL,
    "town" TEXT,

    CONSTRAINT "installation_area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installation_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_installation_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "status" "InstallationStatus" NOT NULL,
    "date" DATE,
    "note" TEXT,
    "changedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_installation_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "installation_area_region_town_key" ON "installation_area"("region", "town");

-- CreateIndex
CREATE UNIQUE INDEX "installation_area_region_key" ON "installation_area"("region") WHERE ("town" IS NULL);

-- CreateIndex
CREATE INDEX "order_installation_history_orderId_idx" ON "order_installation_history"("orderId");

-- CreateIndex
CREATE INDEX "order_installation_history_changedById_idx" ON "order_installation_history"("changedById");

-- AddForeignKey
ALTER TABLE "order_installation_history" ADD CONSTRAINT "order_installation_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_installation_history" ADD CONSTRAINT "order_installation_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Prisma doesn't model CHECK constraints, so they live here.
-- Installation fees are above 0 (no fee is null, or a product's NONE), and a product has its own fee exactly when it
-- says OWN
ALTER TABLE "category" ADD CONSTRAINT "category_installation_fee_positive" CHECK ("installationFeeGhs" IS NULL OR "installationFeeGhs" > 0);
ALTER TABLE "product" ADD CONSTRAINT "product_installation_fee" CHECK (("installation" = 'OWN') = ("installationFeeGhs" IS NOT NULL) AND ("installationFeeGhs" IS NULL OR "installationFeeGhs" > 0));
-- An order line's installation amounts are set together, and never negative
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_installation_amounts" CHECK (
  ("installationUnitGhs" IS NULL AND "installationTotalGhs" = 0 AND "installationTaxGhs" = 0)
  OR ("installationUnitGhs" > 0 AND "installationTotalGhs" > 0 AND "installationTaxGhs" >= 0)
);
-- An order has an installation status exactly when it has installation
ALTER TABLE "order" ADD CONSTRAINT "order_installation" CHECK ("installationGhs" >= 0 AND ("installationStatus" IS NULL) = ("installationGhs" = 0));
