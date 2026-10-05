/*
  Warnings:

  - The `status` column on the `organization` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "organization" DROP COLUMN "status",
ADD COLUMN     "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE';
