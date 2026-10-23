
-- CreateEnum
CREATE TYPE "ProductRequestStatus" AS ENUM ('PENDING', 'CREATED', 'MATCHED', 'DECLINED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'PRODUCT_REQUEST';

-- AlterEnum
ALTER TYPE "PlatformAlert" ADD VALUE 'PRODUCT_REQUESTS';

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "notifyProductRequests" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "product_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "requestedById" UUID,
    "name" TEXT NOT NULL,
    "brandId" UUID,
    "brandName" TEXT,
    "categoryId" UUID,
    "barcode" TEXT,
    "link" TEXT,
    "notes" TEXT,
    "status" "ProductRequestStatus" NOT NULL DEFAULT 'PENDING',
    "productId" UUID,
    "declineReason" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_request_organizationId_createdAt_idx" ON "product_request"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "product_request_status_createdAt_idx" ON "product_request"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "product_request" ADD CONSTRAINT "product_request_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request" ADD CONSTRAINT "product_request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request" ADD CONSTRAINT "product_request_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request" ADD CONSTRAINT "product_request_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request" ADD CONSTRAINT "product_request_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_request" ADD CONSTRAINT "product_request_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A declined request tells the store why
ALTER TABLE "product_request" ADD CONSTRAINT "product_request_decline_reason" CHECK ("status" <> 'DECLINED' OR ("declineReason" IS NOT NULL AND length(trim("declineReason")) > 0));
