ALTER TABLE "Address" RENAME TO "address";
ALTER TABLE "address" RENAME CONSTRAINT "Address_pkey" TO "address_pkey";
ALTER TABLE "address" RENAME CONSTRAINT "Address_userId_fkey" TO "address_userId_fkey";