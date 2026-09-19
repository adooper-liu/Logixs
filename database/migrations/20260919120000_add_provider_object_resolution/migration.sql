-- AlterTable: preserve raw provider observations while recording safe business-object resolution.
ALTER TABLE "ocean_provider_event_ingestion"
ADD COLUMN "container_record_id" TEXT,
ADD COLUMN "object_resolution_state" TEXT NOT NULL DEFAULT 'not_attempted',
ADD COLUMN "object_resolution_reason_code" TEXT,
ADD CONSTRAINT "ocean_provider_ingestion_object_resolution_check"
CHECK (
  ("object_resolution_state" = 'resolved'
    AND "container_record_id" IS NOT NULL
    AND "object_resolution_reason_code" IS NULL)
  OR ("object_resolution_state" IN ('not_found', 'ambiguous')
    AND "container_record_id" IS NULL
    AND "object_resolution_reason_code" IS NOT NULL)
  OR ("object_resolution_state" = 'not_attempted'
    AND "container_record_id" IS NULL
    AND "object_resolution_reason_code" IS NULL)
);

CREATE INDEX "ocean_provider_ingestion_container_idx"
ON "ocean_provider_event_ingestion" ("tenant_id", "container_record_id");

-- Verification:
-- SELECT object_resolution_state, count(*)
-- FROM ocean_provider_event_ingestion GROUP BY object_resolution_state;
-- Recovery: drop the index, CHECK, and three columns; raw ingestion remains intact.
