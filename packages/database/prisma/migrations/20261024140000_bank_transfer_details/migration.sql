-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "bankTransferDetails" TEXT;

-- The settings form allows 1,000 characters
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_bank_transfer_details_length" CHECK (char_length("bankTransferDetails") <= 1000);
