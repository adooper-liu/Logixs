-- Keep immutable source-file metadata in PostgreSQL while the binary lives in
-- MinIO/S3. Historical batches did not retain their source and remain explicit.

ALTER TABLE "import_batch"
ADD COLUMN "source_file_status" TEXT NOT NULL DEFAULT 'not_retained',
ADD COLUMN "source_object_key" TEXT,
ADD COLUMN "source_content_type" TEXT,
ADD COLUMN "source_size_bytes" INTEGER,
ADD COLUMN "source_retained_at" TIMESTAMPTZ;

CREATE UNIQUE INDEX "import_batch_source_object_key_key"
ON "import_batch"("source_object_key");

ALTER TABLE "import_batch"
ADD CONSTRAINT "import_batch_source_file_status_check"
CHECK ("source_file_status" IN ('not_retained', 'retained')),
ADD CONSTRAINT "import_batch_source_file_metadata_check"
CHECK (
  (
    "source_file_status" = 'not_retained'
    AND "source_object_key" IS NULL
    AND "source_content_type" IS NULL
    AND "source_size_bytes" IS NULL
    AND "source_retained_at" IS NULL
  )
  OR
  (
    "source_file_status" = 'retained'
    AND length("source_object_key") > 0
    AND length("source_content_type") > 0
    AND "source_size_bytes" > 0
    AND "source_retained_at" IS NOT NULL
  )
);

-- Verification after deploy:
-- SELECT source_file_status, COUNT(*) FROM import_batch GROUP BY 1;
-- SELECT id FROM import_batch WHERE source_file_status = 'retained'
--   AND (source_object_key IS NULL OR source_size_bytes IS NULL OR source_retained_at IS NULL);
-- Recovery: drop both CHECK constraints, the unique index, then the five new
-- columns. Object deletion is a separate audited operation; never infer it from
-- rolling back this metadata migration.
