-- CreateTable
CREATE TABLE "pickup_supplier" (
    "pickupLocationId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "leadDays" INTEGER NOT NULL,

    CONSTRAINT "pickup_supplier_pkey" PRIMARY KEY ("pickupLocationId","organizationId")
);

-- CreateIndex
CREATE INDEX "pickup_supplier_organizationId_idx" ON "pickup_supplier"("organizationId");

-- AddForeignKey
ALTER TABLE "pickup_supplier" ADD CONSTRAINT "pickup_supplier_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "pickup_location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_supplier" ADD CONSTRAINT "pickup_supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A lead time in whole days
ALTER TABLE "pickup_supplier" ADD CONSTRAINT "pickup_supplier_lead_days" CHECK ("leadDays" BETWEEN 1 AND 60);
