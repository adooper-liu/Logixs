-- Expand import batches with immutable parser provenance and replacement lineage.
-- Existing batches were produced before parser versioning and remain unchanged.

ALTER TABLE "import_batch"
ADD COLUMN "parser_version" TEXT NOT NULL DEFAULT 'legacy-v1',
ADD COLUMN "replaces_batch_id" TEXT;

CREATE INDEX "import_batch_replaces_batch_id_idx"
ON "import_batch"("replaces_batch_id");

ALTER TABLE "import_batch"
ADD CONSTRAINT "import_batch_replaces_batch_id_fkey"
FOREIGN KEY ("replaces_batch_id") REFERENCES "import_batch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verification after deploy:
-- SELECT COUNT(*) FROM import_batch WHERE parser_version IS NULL;
-- SELECT child.id FROM import_batch child LEFT JOIN import_batch parent
--   ON parent.id = child.replaces_batch_id
--   WHERE child.replaces_batch_id IS NOT NULL AND parent.id IS NULL;
-- Recovery: the two columns, index and foreign key can be removed only if no
-- replacement batch has been created; otherwise restore from backup and retain
-- the audit lineage.
