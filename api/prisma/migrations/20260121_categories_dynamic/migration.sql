-- Replace Document.category enum with a relational Category model.
-- This migration backfills existing documents into 3 default categories.

CREATE TABLE "Category" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE
);

-- Seed baseline categories (ids are fixed to avoid relying on extensions)
INSERT INTO "Category" ("id", "name") VALUES
  ('cat_judgment', 'פסקי דין'),
  ('cat_damage_estimate', 'תחשיבי נזק'),
  ('cat_summary', 'סיכומים')
ON CONFLICT ("name") DO NOTHING;

ALTER TABLE "Document" ADD COLUMN "categoryId" TEXT;

-- Backfill from old enum values (if column exists)
UPDATE "Document"
SET "categoryId" = CASE "category"
  WHEN 'JUDGMENT' THEN 'cat_judgment'
  WHEN 'DAMAGE_ESTIMATE' THEN 'cat_damage_estimate'
  WHEN 'SUMMARY' THEN 'cat_summary'
  ELSE 'cat_judgment'
END
WHERE "categoryId" IS NULL;

ALTER TABLE "Document" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Document_categoryId_idx" ON "Document" ("categoryId");

-- Drop old enum column + enum type
ALTER TABLE "Document" DROP COLUMN "category";
DROP TYPE "DocumentCategory";


