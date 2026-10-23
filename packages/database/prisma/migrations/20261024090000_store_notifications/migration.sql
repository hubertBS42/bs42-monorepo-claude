-- AlterTable
ALTER TABLE "member" ADD COLUMN     "notifyOrders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyRefunds" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyStock" BOOLEAN NOT NULL DEFAULT true;
