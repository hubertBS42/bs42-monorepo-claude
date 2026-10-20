-- CreateEnum
CREATE TYPE "SpecType" AS ENUM ('SELECT', 'NUMBER', 'BOOLEAN', 'TEXT');

-- CreateTable
CREATE TABLE "category_spec" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SpecType" NOT NULL,
    "unit" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_spec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_spec_option" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "specId" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_spec_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_spec_value" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL,
    "specId" UUID NOT NULL,
    "optionId" UUID,
    "numberValue" DECIMAL(14,4),
    "booleanValue" BOOLEAN,
    "textValue" TEXT,

    CONSTRAINT "product_spec_value_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_spec_categoryId_name_key" ON "category_spec"("categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "category_spec_option_specId_value_key" ON "category_spec_option"("specId", "value");

-- CreateIndex
CREATE INDEX "product_spec_value_specId_optionId_idx" ON "product_spec_value"("specId", "optionId");

-- CreateIndex
CREATE INDEX "product_spec_value_specId_numberValue_idx" ON "product_spec_value"("specId", "numberValue");

-- CreateIndex
CREATE INDEX "product_spec_value_optionId_idx" ON "product_spec_value"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "product_spec_value_productId_specId_key" ON "product_spec_value"("productId", "specId");

-- AddForeignKey
ALTER TABLE "category_spec" ADD CONSTRAINT "category_spec_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_spec_option" ADD CONSTRAINT "category_spec_option_specId_fkey" FOREIGN KEY ("specId") REFERENCES "category_spec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_spec_value" ADD CONSTRAINT "product_spec_value_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_spec_value" ADD CONSTRAINT "product_spec_value_specId_fkey" FOREIGN KEY ("specId") REFERENCES "category_spec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_spec_value" ADD CONSTRAINT "product_spec_value_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "category_spec_option"("id") ON DELETE CASCADE ON UPDATE CASCADE;
