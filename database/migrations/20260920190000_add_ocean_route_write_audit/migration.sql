-- Audit and idempotency fields for the controlled ocean-route write port.
ALTER TABLE "ocean_route_plan"
  ADD COLUMN "ingestion_channel" TEXT,
  ADD COLUMN "source_system" TEXT,
  ADD COLUMN "evidence_refs" JSONB,
  ADD COLUMN "actor_id" TEXT,
  ADD COLUMN "reason_code" TEXT,
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "payload_hash" TEXT,
  ADD COLUMN "trace_id" TEXT;

UPDATE "ocean_route_plan"
SET
  "ingestion_channel" = 'api',
  "source_system" = 'legacy.route',
  "evidence_refs" = '[]'::jsonb,
  "idempotency_key" = 'legacy:' || "id",
  "payload_hash" = repeat('0', 64),
  "trace_id" = 'legacy:' || "id"
WHERE "ingestion_channel" IS NULL;

ALTER TABLE "ocean_route_plan"
  ALTER COLUMN "ingestion_channel" SET NOT NULL,
  ALTER COLUMN "source_system" SET NOT NULL,
  ALTER COLUMN "evidence_refs" SET NOT NULL,
  ALTER COLUMN "idempotency_key" SET NOT NULL,
  ALTER COLUMN "payload_hash" SET NOT NULL,
  ALTER COLUMN "trace_id" SET NOT NULL,
  ADD CONSTRAINT "ocean_route_plan_ingestion_check" CHECK (
    "ingestion_channel" IN ('api', 'file_import', 'manual_ui')
  ),
  ADD CONSTRAINT "ocean_route_plan_audit_check" CHECK (
    length("source_system") BETWEEN 1 AND 64
    AND jsonb_typeof("evidence_refs") = 'array'
    AND length("idempotency_key") BETWEEN 1 AND 200
    AND "payload_hash" ~ '^[0-9a-f]{64}$'
    AND length("trace_id") BETWEEN 1 AND 128
    AND ("actor_id" IS NULL OR length("actor_id") BETWEEN 1 AND 100)
    AND ("reason_code" IS NULL OR length("reason_code") BETWEEN 1 AND 64)
    AND (
      "ingestion_channel" <> 'manual_ui'
      OR ("actor_id" IS NOT NULL AND "reason_code" IS NOT NULL)
    )
  );

CREATE UNIQUE INDEX "ocean_route_plan_idempotency_key"
ON "ocean_route_plan"("container_id", "idempotency_key");

-- Recovery: application rollback may leave additive audit columns unread.
-- Dropping them removes route provenance and idempotency history and requires a verified backup.
