-- AlterTable
ALTER TABLE "ocean_provider_event_ingestion"
ADD CONSTRAINT "ocean_provider_ingestion_identity_check"
CHECK (
  length(btrim("tenant_id")) > 0
  AND length("provider") BETWEEN 1 AND 64
  AND length("interface_code") BETWEEN 1 AND 100
  AND length("decided_by") BETWEEN 1 AND 128
  AND length("trace_id") BETWEEN 1 AND 128
),
ADD CONSTRAINT "ocean_provider_ingestion_versions_check"
CHECK (
  length(btrim("payload_hash_version")) > 0
  AND length(btrim("mapping_version")) > 0
),
DROP CONSTRAINT "ocean_provider_ingestion_reason_codes_check",
ADD CONSTRAINT "ocean_provider_ingestion_reason_codes_check"
CHECK (
  jsonb_typeof("reason_codes") = 'array'
  AND jsonb_array_length("reason_codes") > 0
);

-- Verification: constraints are validated immediately against existing rows.
-- Recovery: dropping only these three CHECK constraints preserves all ingestion records.
