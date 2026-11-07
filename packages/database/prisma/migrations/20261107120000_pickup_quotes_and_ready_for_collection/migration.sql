-- A quotation staff make can be for pickup, with its address columns left empty
ALTER TABLE "quote" ADD COLUMN "shippingMethod" "ShippingMethod" NOT NULL DEFAULT 'DELIVERY';

-- When staff said a pickup order is ready, which emails the customer once
ALTER TABLE "order" ADD COLUMN "readyForCollectionAt" TIMESTAMP(3);
