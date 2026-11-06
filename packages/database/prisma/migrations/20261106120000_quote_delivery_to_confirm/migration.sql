-- AlterTable
ALTER TABLE "quote" ADD COLUMN     "deliveryToConfirm" BOOLEAN NOT NULL DEFAULT false;

-- A quote with delivery to confirm has none in its amounts
ALTER TABLE "quote" ADD CONSTRAINT "quote_delivery_to_confirm" CHECK (NOT "deliveryToConfirm" OR "shippingGhs" = 0);
