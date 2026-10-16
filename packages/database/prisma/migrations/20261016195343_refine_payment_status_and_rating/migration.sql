-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "order_status_history" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'FAILED';
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterTable
ALTER TABLE "product" ALTER COLUMN "rating" SET DATA TYPE DECIMAL(3,2);


-- Check constraints. Prisma doesn't model these, so they live only in the migration.
-- rating is the average of the reviews (0 before the first one)
ALTER TABLE "product" ADD CONSTRAINT "product_rating_check" CHECK ("rating" >= 0 AND "rating" <= 5);
ALTER TABLE "product" ADD CONSTRAINT "product_num_reviews_check" CHECK ("numReviews" >= 0);
