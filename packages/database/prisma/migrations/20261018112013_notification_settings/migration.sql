-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "notificationEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notifyLowStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOutOfStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyRateFetchFailure" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyStaffOrders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyStorefrontOrders" BOOLEAN NOT NULL DEFAULT true;
