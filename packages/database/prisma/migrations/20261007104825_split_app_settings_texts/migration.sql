ALTER TABLE "app_settings" RENAME COLUMN "name" TO "storeName";
ALTER TABLE "app_settings" RENAME COLUMN "description" TO "storeDescription";
ALTER TABLE "app_settings" ADD COLUMN "consoleName" TEXT, ADD COLUMN "consoleDescription" TEXT;