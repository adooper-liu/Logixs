CREATE TABLE "customs_clearance_case" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "container_record_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "supersedes_case_id" UUID,
  "jurisdiction_country_code" CHAR(2) NOT NULL,
  "customs_broker_party_id" UUID,
  "declaration_number" TEXT,
  "filing_state" TEXT NOT NULL,
  "decision_state" TEXT NOT NULL,
  "active_hold_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ingestion_channel" TEXT NOT NULL,
  "source_system" TEXT NOT NULL,
  "evidence_refs" JSONB NOT NULL,
  "actor_id" TEXT NOT NULL,
  "reason_code" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "superseded_at" TIMESTAMPTZ,
  CONSTRAINT "customs_clearance_case_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customs_clearance_case_version_check" CHECK ("version" > 0),
  CONSTRAINT "customs_clearance_case_state_check" CHECK ("state" IN ('active', 'superseded')),
  CONSTRAINT "customs_clearance_case_state_time_check" CHECK (("state" = 'active' AND "superseded_at" IS NULL) OR ("state" = 'superseded' AND "superseded_at" IS NOT NULL)),
  CONSTRAINT "customs_clearance_case_country_check" CHECK ("jurisdiction_country_code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "customs_clearance_case_filing_check" CHECK ("filing_state" IN ('not_filed', 'filed', 'accepted')),
  CONSTRAINT "customs_clearance_case_decision_check" CHECK ("decision_state" IN ('pending', 'held', 'released')),
  CONSTRAINT "customs_clearance_case_declaration_check" CHECK (("filing_state" = 'not_filed') OR ("declaration_number" IS NOT NULL AND length("declaration_number") BETWEEN 1 AND 100 AND "declaration_number" = btrim("declaration_number"))),
  CONSTRAINT "customs_clearance_case_broker_check" CHECK (("filing_state" = 'not_filed') OR "customs_broker_party_id" IS NOT NULL),
  CONSTRAINT "customs_clearance_case_hold_check" CHECK (("decision_state" = 'held' AND cardinality("active_hold_codes") > 0) OR ("decision_state" <> 'held' AND cardinality("active_hold_codes") = 0)),
  CONSTRAINT "customs_clearance_case_release_check" CHECK ("decision_state" <> 'released' OR "filing_state" = 'accepted'),
  CONSTRAINT "customs_clearance_case_ingestion_check" CHECK ("ingestion_channel" IN ('api', 'webhook', 'file_import', 'manual_ui')),
  CONSTRAINT "customs_clearance_case_evidence_check" CHECK (jsonb_typeof("evidence_refs") = 'array' AND ("decision_state" <> 'released' OR jsonb_array_length("evidence_refs") > 0)),
  CONSTRAINT "customs_clearance_case_source_check" CHECK (length("source_system") BETWEEN 1 AND 128 AND "source_system" = btrim("source_system")),
  CONSTRAINT "customs_clearance_case_actor_check" CHECK (length("actor_id") BETWEEN 1 AND 128 AND "actor_id" = btrim("actor_id")),
  CONSTRAINT "customs_clearance_case_reason_check" CHECK (length("reason_code") BETWEEN 1 AND 64 AND "reason_code" = btrim("reason_code")),
  CONSTRAINT "customs_clearance_case_idempotency_check" CHECK (length("idempotency_key") BETWEEN 1 AND 200 AND "idempotency_key" = btrim("idempotency_key")),
  CONSTRAINT "customs_clearance_case_payload_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "customs_clearance_case_id_tenant_key" ON "customs_clearance_case"("id", "tenant_id");
CREATE UNIQUE INDEX "customs_clearance_case_id_scope_key" ON "customs_clearance_case"("id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "customs_clearance_case_tenant_idempotency_key" ON "customs_clearance_case"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "customs_clearance_case_container_version_key" ON "customs_clearance_case"("container_record_id", "version");
CREATE UNIQUE INDEX "customs_clearance_case_supersedes_scope_key" ON "customs_clearance_case"("supersedes_case_id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "customs_clearance_case_one_active_key" ON "customs_clearance_case"("tenant_id", "container_record_id") WHERE "state" = 'active';
CREATE INDEX "customs_clearance_case_active_lookup_idx" ON "customs_clearance_case"("tenant_id", "container_record_id", "state");
CREATE INDEX "customs_clearance_case_broker_idx" ON "customs_clearance_case"("tenant_id", "customs_broker_party_id");

ALTER TABLE "customs_clearance_case" ADD CONSTRAINT "customs_clearance_case_container_fkey" FOREIGN KEY ("container_record_id", "tenant_id") REFERENCES "container_record"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customs_clearance_case" ADD CONSTRAINT "customs_clearance_case_supersedes_fkey" FOREIGN KEY ("supersedes_case_id", "tenant_id", "container_record_id") REFERENCES "customs_clearance_case"("id", "tenant_id", "container_record_id") ON DELETE RESTRICT ON UPDATE CASCADE;
