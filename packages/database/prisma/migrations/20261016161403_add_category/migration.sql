-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "parentId" UUID,
    "status" "Status" NOT NULL DEFAULT 'DRAFT',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "category_parentId_name_key" ON "category"("parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "category_root_name_key" ON "category"("name") WHERE ("parentId" IS NULL);

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "category"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Reject a parent that is the category itself or one of its descendants, which would make a cycle.
-- Prisma doesn't model triggers, so this lives only in the migration.
CREATE FUNCTION "category_prevent_cycle"() RETURNS trigger AS $$
BEGIN
  IF NEW."parentId" IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialise hierarchy changes so two concurrent moves can't each pass the check and form a cycle together
  PERFORM pg_advisory_xact_lock(hashtext('category_hierarchy'));

  IF EXISTS (
    WITH RECURSIVE "ancestors"("id") AS (
      SELECT NEW."parentId"
      UNION
      SELECT c."parentId" FROM "category" c JOIN "ancestors" a ON c."id" = a."id" WHERE c."parentId" IS NOT NULL
    )
    SELECT 1 FROM "ancestors" WHERE "id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'category_no_cycle: a category cannot be moved under itself or one of its subcategories'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'category_no_cycle';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "category_prevent_cycle"
BEFORE INSERT OR UPDATE OF "parentId" ON "category"
FOR EACH ROW EXECUTE FUNCTION "category_prevent_cycle"();
