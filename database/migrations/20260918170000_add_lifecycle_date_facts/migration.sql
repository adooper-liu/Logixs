-- Existing import time facts retain null for history; all new date-bearing imports require this explicitly.
ALTER TABLE "shipment_time_fact"
ADD COLUMN "authority_system" TEXT;

ALTER TABLE "shipment_time_fact"
ADD CONSTRAINT "shipment_time_fact_authority_system_check"
CHECK (
  "authority_system" IS NULL
  OR length("authority_system") BETWEEN 1 AND 64
);

-- CreateTable
CREATE TABLE "lifecycle_date_fact" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "node_code" TEXT NOT NULL,
    "event_code" TEXT NOT NULL,
    "time_kind" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "raw_value" TEXT NOT NULL,
    "source_utc_offset" TEXT NOT NULL,
    "ingestion_channel" TEXT NOT NULL,
    "capture_source" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "authority_system" TEXT NOT NULL,
    "provider" TEXT,
    "interface_code" TEXT,
    "source_event_id" TEXT,
    "mapping_version" TEXT,
    "verification_state" TEXT NOT NULL,
    "confidence_state" TEXT NOT NULL,
    "validity" TEXT NOT NULL,
    "authority_policy_ref" TEXT,
    "evidence_refs" JSONB NOT NULL,
    "actor_id" TEXT,
    "reason_code" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "supersedes_fact_id" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "application_state" TEXT NOT NULL,
    "application_reason_code" TEXT,
    "canonical_event_id" TEXT,
    "projection_version" INTEGER NOT NULL,
    "trace_id" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lifecycle_date_fact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lifecycle_date_fact_identity_check" CHECK (
      length(btrim("tenant_id")) > 0
      AND length(btrim("container_id")) > 0
      AND length("node_code") BETWEEN 1 AND 100
      AND length("event_code") BETWEEN 1 AND 100
      AND length("raw_value") BETWEEN 1 AND 200
      AND length("source_system") BETWEEN 1 AND 64
      AND length("authority_system") BETWEEN 1 AND 64
      AND ("provider" IS NULL OR length("provider") BETWEEN 1 AND 64)
      AND ("interface_code" IS NULL OR length("interface_code") BETWEEN 1 AND 100)
      AND ("source_event_id" IS NULL OR length("source_event_id") BETWEEN 1 AND 200)
      AND ("mapping_version" IS NULL OR length("mapping_version") BETWEEN 1 AND 100)
      AND ("authority_policy_ref" IS NULL OR length("authority_policy_ref") BETWEEN 1 AND 200)
      AND ("reason_code" IS NULL OR length("reason_code") BETWEEN 1 AND 64)
      AND length("idempotency_key") BETWEEN 1 AND 200
      AND length("trace_id") BETWEEN 1 AND 128
    ),
    CONSTRAINT "lifecycle_date_fact_time_kind_check"
      CHECK ("time_kind" IN ('planned', 'estimated', 'actual')),
    CONSTRAINT "lifecycle_date_fact_channel_check"
      CHECK ("ingestion_channel" IN ('api', 'webhook', 'file_import', 'manual_ui')),
    CONSTRAINT "lifecycle_date_fact_capture_source_check"
      CHECK ("capture_source" IN ('external_evidence', 'manual_backfill', 'controlled_import', 'internal_operation', 'system_derived')),
    CONSTRAINT "lifecycle_date_fact_verification_check"
      CHECK ("verification_state" IN ('pending', 'verified', 'rejected', 'revoked')),
    CONSTRAINT "lifecycle_date_fact_confidence_check"
      CHECK ("confidence_state" IN ('confirmed', 'provisional', 'disputed', 'unknown')),
    CONSTRAINT "lifecycle_date_fact_validity_check"
      CHECK ("validity" IN ('effective', 'superseded', 'corrected', 'revoked')),
    CONSTRAINT "lifecycle_date_fact_application_check"
      CHECK ("application_state" IN ('not_applicable', 'review_required', 'pending_application', 'applied', 'rejected')),
    CONSTRAINT "lifecycle_date_fact_offset_check"
      CHECK ("source_utc_offset" ~ '^(?:[+-](?:0[0-9]|1[0-3]):[0-5][0-9]|[+-]14:00)$'),
    CONSTRAINT "lifecycle_date_fact_evidence_check"
      CHECK (jsonb_typeof("evidence_refs") = 'array'),
    CONSTRAINT "lifecycle_date_fact_hash_check"
      CHECK ("payload_hash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "lifecycle_date_fact_version_check"
      CHECK ("projection_version" >= 1),
    CONSTRAINT "lifecycle_date_fact_manual_check"
      CHECK (
        "ingestion_channel" <> 'manual_ui'
        OR ("capture_source" = 'manual_backfill' AND "actor_id" IS NOT NULL AND "reason_code" IS NOT NULL)
      ),
    CONSTRAINT "lifecycle_date_fact_actual_evidence_check"
      CHECK ("time_kind" <> 'actual' OR jsonb_array_length("evidence_refs") > 0),
    CONSTRAINT "lifecycle_date_fact_application_event_check"
      CHECK (
        ("application_state" = 'applied' AND "canonical_event_id" IS NOT NULL)
        OR ("application_state" <> 'applied' AND "canonical_event_id" IS NULL)
      )
);

CREATE UNIQUE INDEX "lifecycle_date_fact_tenant_idempotency_key"
ON "lifecycle_date_fact"("tenant_id", "idempotency_key");

CREATE UNIQUE INDEX "lifecycle_date_fact_container_version_key"
ON "lifecycle_date_fact"("container_id", "projection_version");

CREATE UNIQUE INDEX "lifecycle_date_fact_canonical_event_key"
ON "lifecycle_date_fact"("canonical_event_id");

CREATE INDEX "lifecycle_date_fact_current_idx"
ON "lifecycle_date_fact"("tenant_id", "container_id", "is_current");

CREATE INDEX "lifecycle_date_fact_slot_idx"
ON "lifecycle_date_fact"("container_id", "node_code", "event_code", "time_kind", "is_current");

CREATE INDEX "lifecycle_date_fact_application_idx"
ON "lifecycle_date_fact"("application_state", "recorded_at", "id");

ALTER TABLE "lifecycle_date_fact"
ADD CONSTRAINT "lifecycle_date_fact_container_id_fkey"
FOREIGN KEY ("container_id") REFERENCES "container_record"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lifecycle_date_fact"
ADD CONSTRAINT "lifecycle_date_fact_supersedes_fact_id_fkey"
FOREIGN KEY ("supersedes_fact_id") REFERENCES "lifecycle_date_fact"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lifecycle_date_fact"
ADD CONSTRAINT "lifecycle_date_fact_canonical_event_id_fkey"
FOREIGN KEY ("canonical_event_id") REFERENCES "canonical_event"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verification: all facts retain source/time semantics and each container projection version is monotonic.
-- Recovery: application rollback may leave this append-only table unread; dropping it loses date audit history.
