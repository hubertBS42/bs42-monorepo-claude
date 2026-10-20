-- CreateTable
CREATE TABLE "delivery_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "freeDeliveryFromGhs" DECIMAL(12,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_rate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region" TEXT NOT NULL,
    "town" TEXT,
    "feeGhs" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "delivery_rate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_rate_region_town_key" ON "delivery_rate"("region", "town");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_rate_region_key" ON "delivery_rate"("region") WHERE ("town" IS NULL);

-- Fees and the free-delivery threshold are never negative. Prisma doesn't model CHECK constraints, so they live here.
ALTER TABLE "delivery_rate" ADD CONSTRAINT "delivery_rate_fee_not_negative" CHECK ("feeGhs" >= 0);
ALTER TABLE "delivery_settings" ADD CONSTRAINT "delivery_settings_free_from_not_negative" CHECK ("freeDeliveryFromGhs" IS NULL OR "freeDeliveryFromGhs" >= 0);
