-- AlterTable
ALTER TABLE "legal_pages" ADD COLUMN     "privacyPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termsPublished" BOOLEAN NOT NULL DEFAULT false;

-- Pages already written stay on the storefront, as they were before publishing existed
UPDATE "legal_pages" SET "termsPublished" = "termsOfService" IS NOT NULL, "privacyPublished" = "privacyPolicy" IS NOT NULL;

-- A published page has text
ALTER TABLE "legal_pages" ADD CONSTRAINT "legal_pages_terms_published" CHECK (NOT "termsPublished" OR "termsOfService" IS NOT NULL);
ALTER TABLE "legal_pages" ADD CONSTRAINT "legal_pages_privacy_published" CHECK (NOT "privacyPublished" OR "privacyPolicy" IS NOT NULL);
