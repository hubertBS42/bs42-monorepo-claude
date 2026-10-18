-- CreateEnum
CREATE TYPE "ExchangeRateSource" AS ENUM ('MANUAL', 'OPEN_EXCHANGE_RATES');

-- AlterTable
ALTER TABLE "exchange_rate" ADD COLUMN     "source" "ExchangeRateSource" NOT NULL DEFAULT 'MANUAL';
