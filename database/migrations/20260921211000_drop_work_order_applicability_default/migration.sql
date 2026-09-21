-- The preceding migration used a temporary default to expand/backfill safely.
-- Future work orders must choose applicability explicitly from their definition.
ALTER TABLE "work_order"
ALTER COLUMN "applicability" DROP DEFAULT;
