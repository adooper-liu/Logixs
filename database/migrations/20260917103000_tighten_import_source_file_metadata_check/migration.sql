-- PostgreSQL CHECK constraints accept UNKNOWN, so every retained metadata
-- column must be explicitly non-null before applying value constraints.

ALTER TABLE "import_batch"
DROP CONSTRAINT "import_batch_source_file_metadata_check";

ALTER TABLE "import_batch"
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
    AND "source_object_key" IS NOT NULL
    AND "source_content_type" IS NOT NULL
    AND "source_size_bytes" IS NOT NULL
    AND "source_retained_at" IS NOT NULL
    AND length("source_object_key") > 0
    AND length("source_content_type") > 0
    AND "source_size_bytes" > 0
  )
);

-- Verification after deploy:
-- SELECT id FROM import_batch WHERE source_file_status = 'retained'
--   AND (source_object_key IS NULL OR source_content_type IS NULL
--     OR source_size_bytes IS NULL OR source_retained_at IS NULL);
-- Recovery: drop this constraint and recreate the prior definition from
-- 20260917090000_add_import_source_file_retention. No data rewrite is needed.
