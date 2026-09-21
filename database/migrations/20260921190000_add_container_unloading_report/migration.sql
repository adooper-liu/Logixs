CREATE TABLE "container_unloading_report" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "container_record_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "supersedes_report_id" UUID,
  "warehouse_location_id" UUID NOT NULL,
  "operation_state" TEXT NOT NULL,
  "started_at" TIMESTAMPTZ NOT NULL,
  "completed_at" TIMESTAMPTZ,
  "expected_quantity" DECIMAL(18,3) NOT NULL,
  "unloaded_quantity" DECIMAL(18,3) NOT NULL,
  "remaining_quantity" DECIMAL(18,3) NOT NULL,
  "damaged_quantity" DECIMAL(18,3) NOT NULL,
  "shortage_quantity" DECIMAL(18,3) NOT NULL,
  "quantity_unit" TEXT NOT NULL,
  "seal_check" TEXT NOT NULL,
  "exception_resolved" BOOLEAN NOT NULL,
  "exception_notes" TEXT,
  "ingestion_channel" TEXT NOT NULL,
  "source_system" TEXT NOT NULL,
  "evidence_refs" JSONB NOT NULL,
  "actor_id" TEXT NOT NULL,
  "reason_code" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "superseded_at" TIMESTAMPTZ,
  CONSTRAINT "container_unloading_report_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "container_unloading_report_version_check" CHECK ("version" > 0),
  CONSTRAINT "container_unloading_report_state_check" CHECK ("state" IN ('active', 'superseded')),
  CONSTRAINT "container_unloading_report_state_time_check" CHECK (("state" = 'active' AND "superseded_at" IS NULL) OR ("state" = 'superseded' AND "superseded_at" IS NOT NULL)),
  CONSTRAINT "container_unloading_report_operation_check" CHECK ("operation_state" IN ('started', 'partial', 'completed')),
  CONSTRAINT "container_unloading_report_time_check" CHECK (("operation_state" = 'completed' AND "completed_at" IS NOT NULL AND "completed_at" >= "started_at") OR ("operation_state" <> 'completed' AND "completed_at" IS NULL)),
  CONSTRAINT "container_unloading_report_quantity_check" CHECK ("expected_quantity" > 0 AND "unloaded_quantity" >= 0 AND "remaining_quantity" >= 0 AND "damaged_quantity" >= 0 AND "shortage_quantity" >= 0 AND "unloaded_quantity" + "remaining_quantity" + "shortage_quantity" = "expected_quantity" AND "damaged_quantity" <= "unloaded_quantity"),
  CONSTRAINT "container_unloading_report_progress_check" CHECK (("operation_state" = 'started' AND "unloaded_quantity" = 0 AND "remaining_quantity" = "expected_quantity" AND "shortage_quantity" = 0 AND "damaged_quantity" = 0) OR ("operation_state" = 'partial' AND "unloaded_quantity" > 0 AND "remaining_quantity" > 0) OR ("operation_state" = 'completed' AND "remaining_quantity" = 0)),
  CONSTRAINT "container_unloading_report_unit_check" CHECK ("quantity_unit" IN ('piece', 'carton', 'set', 'pallet')),
  CONSTRAINT "container_unloading_report_seal_check" CHECK ("seal_check" IN ('matched', 'mismatch')),
  CONSTRAINT "container_unloading_report_exception_check" CHECK (("seal_check" = 'matched' AND "damaged_quantity" = 0 AND "shortage_quantity" = 0) OR ("exception_notes" IS NOT NULL AND length("exception_notes") BETWEEN 1 AND 1000 AND "exception_notes" = btrim("exception_notes"))),
  CONSTRAINT "container_unloading_report_completion_check" CHECK ("operation_state" <> 'completed' OR (("seal_check" = 'matched' AND "damaged_quantity" = 0 AND "shortage_quantity" = 0) OR "exception_resolved")),
  CONSTRAINT "container_unloading_report_ingestion_check" CHECK ("ingestion_channel" IN ('api', 'webhook', 'file_import', 'manual_ui')),
  CONSTRAINT "container_unloading_report_evidence_check" CHECK (jsonb_typeof("evidence_refs") = 'array' AND jsonb_array_length("evidence_refs") > 0),
  CONSTRAINT "container_unloading_report_source_check" CHECK (length("source_system") BETWEEN 1 AND 128 AND "source_system" = btrim("source_system")),
  CONSTRAINT "container_unloading_report_actor_check" CHECK (length("actor_id") BETWEEN 1 AND 128 AND "actor_id" = btrim("actor_id")),
  CONSTRAINT "container_unloading_report_reason_check" CHECK ("reason_code" ~ '^[a-z][a-z0-9_]{0,99}$'),
  CONSTRAINT "container_unloading_report_idempotency_check" CHECK (length("idempotency_key") BETWEEN 1 AND 200 AND "idempotency_key" = btrim("idempotency_key")),
  CONSTRAINT "container_unloading_report_payload_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "container_unloading_report_id_tenant_key" ON "container_unloading_report"("id", "tenant_id");
CREATE UNIQUE INDEX "container_unloading_report_id_scope_key" ON "container_unloading_report"("id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "container_unloading_report_tenant_idempotency_key" ON "container_unloading_report"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "container_unloading_report_container_version_key" ON "container_unloading_report"("container_record_id", "version");
CREATE UNIQUE INDEX "container_unloading_report_supersedes_scope_key" ON "container_unloading_report"("supersedes_report_id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "container_unloading_report_one_active_key" ON "container_unloading_report"("tenant_id", "container_record_id") WHERE "state" = 'active';
CREATE INDEX "container_unloading_report_active_lookup_idx" ON "container_unloading_report"("tenant_id", "container_record_id", "state");
CREATE INDEX "container_unloading_report_warehouse_idx" ON "container_unloading_report"("tenant_id", "warehouse_location_id", "state");

ALTER TABLE "container_unloading_report" ADD CONSTRAINT "container_unloading_report_container_fkey" FOREIGN KEY ("container_record_id", "tenant_id") REFERENCES "container_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "container_unloading_report" ADD CONSTRAINT "container_unloading_report_supersedes_fkey" FOREIGN KEY ("supersedes_report_id", "tenant_id", "container_record_id") REFERENCES "container_unloading_report"("id", "tenant_id", "container_record_id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "source_authority_policy" (
  "id", "policy_id", "policy_version", "effective_from", "effective_to",
  "tenant_scope", "fact_type", "event_code", "field_code", "subject_type",
  "jurisdiction", "direction", "location_role", "transport_mode", "time_kind",
  "allowed_authority_systems", "allowed_source_types", "minimum_authority_level",
  "required_evidence_types", "verification_requirements", "corroboration_rule",
  "conflict_action", "manual_correction_policy_ref", "sealing_policy_ref",
  "created_at", "updated_at"
) VALUES (
  '91000000-0000-4000-8000-000000000013',
  '91000000-0000-4000-8000-000000000103',
  1,
  '1970-01-01T00:00:00Z',
  NULL,
  NULL,
  NULL,
  'unloaded',
  NULL,
  'container',
  NULL,
  NULL,
  NULL,
  NULL,
  'actual',
  '["warehouse-receiving"]'::jsonb,
  '["organization", "authority", "system"]'::jsonb,
  'operational',
  '["receipt"]'::jsonb,
  '["tenant_match", "subject_match", "verified", "effective", "authority_system_match"]'::jsonb,
  NULL,
  'review',
  'manual-date-correction-v1',
  'lifecycle-history-sealing-v1',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
