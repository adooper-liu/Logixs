-- Add auditable shipment time facts without widening container_record. Imported
-- facts do not update lifecycle projections; canonical-event promotion remains
-- behind evidence verification and lifecycle-control guards.

CREATE TABLE "shipment_time_fact" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "container_record_id" TEXT NOT NULL,
    "fact_code" TEXT NOT NULL,
    "time_kind" TEXT NOT NULL,
    "capture_source" TEXT NOT NULL,
    "event_code" TEXT,
    "raw_value" TEXT NOT NULL,
    "occurred_at_utc" TIMESTAMPTZ NOT NULL,
    "source_utc_offset" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "source_status" TEXT,
    "evidence_ref" TEXT,
    "derivation_rule_version" TEXT,
    "source_batch_id" TEXT NOT NULL,
    "source_row_id" TEXT NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "superseded_by_batch_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shipment_time_fact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipment_time_fact_code_check" CHECK (
      "fact_code" IN (
        'customs_clearance_completed',
        'container_unloading_completed',
        'container_empty_confirmed',
        'container_empty_estimated'
      )
    ),
    CONSTRAINT "shipment_time_fact_kind_check" CHECK ("time_kind" IN ('actual', 'estimated')),
    CONSTRAINT "shipment_time_fact_capture_check" CHECK (
      "capture_source" IN ('controlled_import', 'system_derived')
    ),
    CONSTRAINT "shipment_time_fact_source_check" CHECK (
      length(btrim("raw_value")) > 0
      AND length(btrim("source_system")) > 0
      AND "source_utc_offset" ~ '^[+-](0[0-9]|1[0-4]):[0-5][0-9]$'
    ),
    CONSTRAINT "shipment_time_fact_semantics_check" CHECK (
      (
        "time_kind" = 'actual'
        AND "capture_source" = 'controlled_import'
        AND "event_code" IS NOT NULL
        AND "source_status" IS NOT NULL
        AND "evidence_ref" IS NOT NULL
        AND "derivation_rule_version" IS NULL
      )
      OR
      (
        "time_kind" = 'estimated'
        AND "capture_source" = 'system_derived'
        AND "event_code" IS NULL
        AND "source_status" IS NULL
        AND "evidence_ref" IS NULL
        AND "derivation_rule_version" IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX "shipment_time_fact_source_key"
ON "shipment_time_fact"("source_batch_id", "source_row_id", "fact_code");

CREATE INDEX "shipment_time_fact_tenant_container_idx"
ON "shipment_time_fact"("tenant_id", "container_record_id");

CREATE INDEX "shipment_time_fact_current_idx"
ON "shipment_time_fact"("container_record_id", "fact_code", "is_current");

ALTER TABLE "shipment_time_fact"
ADD CONSTRAINT "shipment_time_fact_container_record_id_fkey"
FOREIGN KEY ("container_record_id") REFERENCES "container_record"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verification after deploy:
-- SELECT time_kind, capture_source, COUNT(*) FROM shipment_time_fact GROUP BY 1,2;
-- SELECT * FROM shipment_time_fact WHERE time_kind = 'actual' AND evidence_ref IS NULL;
-- Recovery: this is an additive table. It may be dropped only if no time facts
-- have been imported; otherwise restore from backup or export/replay facts first.
