
-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "exchangeRateMarkupPercent" DECIMAL(4,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "exchange_rate" ADD COLUMN     "marketRate" DECIMAL(12,6);


-- Prisma doesn't model CHECK constraints, so they live here
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_rate_markup" CHECK ("exchangeRateMarkupPercent" BETWEEN 0 AND 10);
