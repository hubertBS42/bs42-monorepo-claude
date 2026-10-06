-- AlterTable
ALTER TABLE "user" ADD COLUMN     "dob" DATE,
ADD COLUMN     "getMarketingEmails" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "getOrderEmails" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "getSecurityEmails" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" TEXT;
