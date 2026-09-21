CREATE TABLE "warehouse_delivery_instruction" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "container_record_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "supersedes_instruction_id" UUID,
  "warehouse_location_id" UUID NOT NULL,
  "warehouse_code" TEXT,
  "warehouse_name" TEXT NOT NULL,
  "unlocode" CHAR(5),
  "timezone" TEXT NOT NULL,
  "appointment_start_at" TIMESTAMPTZ,
  "appointment_end_at" TIMESTAMPTZ,
  "appointment_reference" TEXT,
  "ingestion_channel" TEXT NOT NULL,
  "source_system" TEXT NOT NULL,
  "evidence_refs" JSONB NOT NULL,
  "actor_id" TEXT NOT NULL,
  "reason_code" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "superseded_at" TIMESTAMPTZ,
  CONSTRAINT "warehouse_delivery_instruction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "warehouse_delivery_instruction_version_check" CHECK ("version" > 0),
  CONSTRAINT "warehouse_delivery_instruction_state_check" CHECK ("state" IN ('active', 'superseded')),
  CONSTRAINT "warehouse_delivery_instruction_state_time_check" CHECK (("state" = 'active' AND "superseded_at" IS NULL) OR ("state" = 'superseded' AND "superseded_at" IS NOT NULL)),
  CONSTRAINT "warehouse_delivery_instruction_code_check" CHECK ("warehouse_code" IS NULL OR (length("warehouse_code") BETWEEN 1 AND 64 AND "warehouse_code" = btrim("warehouse_code"))),
  CONSTRAINT "warehouse_delivery_instruction_name_check" CHECK (length("warehouse_name") BETWEEN 1 AND 200 AND "warehouse_name" = btrim("warehouse_name")),
  CONSTRAINT "warehouse_delivery_instruction_unlocode_check" CHECK ("unlocode" IS NULL OR "unlocode" ~ '^[A-Z]{2}[A-Z0-9]{3}$'),
  CONSTRAINT "warehouse_delivery_instruction_timezone_check" CHECK (length("timezone") BETWEEN 1 AND 100 AND "timezone" = btrim("timezone")),
  CONSTRAINT "warehouse_delivery_instruction_window_check" CHECK (("appointment_start_at" IS NULL AND "appointment_end_at" IS NULL) OR ("appointment_start_at" IS NOT NULL AND "appointment_end_at" > "appointment_start_at")),
  CONSTRAINT "warehouse_delivery_instruction_reference_check" CHECK ("appointment_reference" IS NULL OR (length("appointment_reference") BETWEEN 1 AND 100 AND "appointment_reference" = btrim("appointment_reference"))),
  CONSTRAINT "warehouse_delivery_instruction_ingestion_check" CHECK ("ingestion_channel" IN ('api', 'webhook', 'file_import', 'manual_ui')),
  CONSTRAINT "warehouse_delivery_instruction_evidence_check" CHECK (jsonb_typeof("evidence_refs") = 'array' AND jsonb_array_length("evidence_refs") > 0),
  CONSTRAINT "warehouse_delivery_instruction_source_check" CHECK (length("source_system") BETWEEN 1 AND 128 AND "source_system" = btrim("source_system")),
  CONSTRAINT "warehouse_delivery_instruction_actor_check" CHECK (length("actor_id") BETWEEN 1 AND 128 AND "actor_id" = btrim("actor_id")),
  CONSTRAINT "warehouse_delivery_instruction_reason_check" CHECK ("reason_code" ~ '^[a-z][a-z0-9_]{0,99}$'),
  CONSTRAINT "warehouse_delivery_instruction_idempotency_check" CHECK (length("idempotency_key") BETWEEN 1 AND 200 AND "idempotency_key" = btrim("idempotency_key")),
  CONSTRAINT "warehouse_delivery_instruction_payload_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "warehouse_delivery_instruction_id_tenant_key" ON "warehouse_delivery_instruction"("id", "tenant_id");
CREATE UNIQUE INDEX "warehouse_delivery_instruction_id_scope_key" ON "warehouse_delivery_instruction"("id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "warehouse_delivery_instruction_tenant_idempotency_key" ON "warehouse_delivery_instruction"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "warehouse_delivery_instruction_container_version_key" ON "warehouse_delivery_instruction"("container_record_id", "version");
CREATE UNIQUE INDEX "warehouse_delivery_instruction_supersedes_scope_key" ON "warehouse_delivery_instruction"("supersedes_instruction_id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "warehouse_delivery_instruction_one_active_key" ON "warehouse_delivery_instruction"("tenant_id", "container_record_id") WHERE "state" = 'active';
CREATE INDEX "warehouse_delivery_instruction_active_lookup_idx" ON "warehouse_delivery_instruction"("tenant_id", "container_record_id", "state");
CREATE INDEX "warehouse_delivery_instruction_warehouse_idx" ON "warehouse_delivery_instruction"("tenant_id", "warehouse_location_id", "state");

ALTER TABLE "warehouse_delivery_instruction" ADD CONSTRAINT "warehouse_delivery_instruction_container_fkey" FOREIGN KEY ("container_record_id", "tenant_id") REFERENCES "container_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouse_delivery_instruction" ADD CONSTRAINT "warehouse_delivery_instruction_supersedes_fkey" FOREIGN KEY ("supersedes_instruction_id", "tenant_id", "container_record_id") REFERENCES "warehouse_delivery_instruction"("id", "tenant_id", "container_record_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Global V1 baselines use stable authority categories. Tenant-scoped policies are
-- more specific and can replace these without changing lifecycle code.
INSERT INTO "source_authority_policy" (
  "id", "policy_id", "policy_version", "effective_from", "effective_to",
  "tenant_scope", "fact_type", "event_code", "field_code", "subject_type",
  "jurisdiction", "direction", "location_role", "transport_mode", "time_kind",
  "allowed_authority_systems", "allowed_source_types", "minimum_authority_level",
  "required_evidence_types", "verification_requirements", "corroboration_rule",
  "conflict_action", "manual_correction_policy_ref", "sealing_policy_ref",
  "created_at", "updated_at"
) VALUES
(
  '91000000-0000-4000-8000-000000000011',
  '91000000-0000-4000-8000-000000000101',
  1,
  '1970-01-01T00:00:00Z',
  NULL,
  NULL,
  NULL,
  'delivered',
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
),
(
  '91000000-0000-4000-8000-000000000012',
  '91000000-0000-4000-8000-000000000102',
  1,
  '1970-01-01T00:00:00Z',
  NULL,
  NULL,
  NULL,
  'warehouse_arrival',
  NULL,
  'container',
  NULL,
  NULL,
  NULL,
  NULL,
  'actual',
  '["warehouse-wms"]'::jsonb,
  '["organization", "authority", "system"]'::jsonb,
  'operational',
  '["system_record"]'::jsonb,
  '["tenant_match", "subject_match", "verified", "effective", "authority_system_match"]'::jsonb,
  NULL,
  'review',
  'manual-date-correction-v1',
  'lifecycle-history-sealing-v1',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
