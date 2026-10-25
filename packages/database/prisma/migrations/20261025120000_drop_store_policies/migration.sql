-- Stores no longer have their own shipping and returns policies: the platform is the seller, and customers never see stores
ALTER TABLE "organization" DROP COLUMN "returnsPolicy",
DROP COLUMN "shippingPolicy";
