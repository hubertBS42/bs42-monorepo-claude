-- CreateTable
CREATE TABLE "branch_group" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_membership" (
    "organizationId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_membership_pkey" PRIMARY KEY ("organizationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_group_name_key" ON "branch_group"("name");

-- CreateIndex
CREATE INDEX "branch_membership_groupId_idx" ON "branch_membership"("groupId");

-- AddForeignKey
ALTER TABLE "branch_membership" ADD CONSTRAINT "branch_membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_membership" ADD CONSTRAINT "branch_membership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "branch_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- With one store, it's the business's first branch: a group named after the storefront
INSERT INTO "branch_group" ("name")
SELECT COALESCE(NULLIF(TRIM(s."storeName"), ''), 'Main')
FROM "app_settings" s
WHERE s."id" = 'singleton' AND (SELECT COUNT(*) FROM "organization" WHERE "slug" <> 'global') = 1;

INSERT INTO "branch_membership" ("organizationId", "groupId")
SELECT o."id", g."id"
FROM "organization" o CROSS JOIN "branch_group" g
WHERE o."slug" <> 'global' AND (SELECT COUNT(*) FROM "organization" WHERE "slug" <> 'global') = 1;
