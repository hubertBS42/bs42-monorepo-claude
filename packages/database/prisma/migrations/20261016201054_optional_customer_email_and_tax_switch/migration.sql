-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "taxEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "order" ALTER COLUMN "customerEmail" DROP NOT NULL;

