CREATE TABLE "compliance_rule" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "rule_code" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compliance_rule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "compliance_rule_code_check" CHECK ("rule_code" ~ '^[A-Z][A-Z0-9_.-]{2,63}$')
);

CREATE UNIQUE INDEX "compliance_rule_id_tenant_key" ON "compliance_rule"("id", "tenant_id");
CREATE UNIQUE INDEX "compliance_rule_tenant_code_key" ON "compliance_rule"("tenant_id", "rule_code");

CREATE TABLE "compliance_rule_version" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "rule_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "requirement_layer" TEXT NOT NULL,
  "jurisdiction_country_code" CHAR(2) NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "applies_to_all_skus" BOOLEAN NOT NULL,
  "battery_requirement" TEXT NOT NULL,
  "refrigerant_requirement" TEXT NOT NULL,
  "dangerous_goods_requirement" TEXT NOT NULL,
  "required_certificate_types" JSONB NOT NULL,
  "blocking_node_codes" JSONB NOT NULL,
  "severity" TEXT NOT NULL,
  "official_source_url" TEXT NOT NULL,
  "legal_citation" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "approved_by" TEXT NOT NULL,
  "approved_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersedes_rule_version_id" UUID,
  "evidence_refs" JSONB NOT NULL,
  "reason_code" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retired_at" TIMESTAMPTZ,
  CONSTRAINT "compliance_rule_version_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "compliance_rule_version_number_check" CHECK ("version" > 0),
  CONSTRAINT "compliance_rule_version_state_check" CHECK ("state" IN ('published', 'retired')),
  CONSTRAINT "compliance_rule_version_layer_check" CHECK ("requirement_layer" IN ('law_regulation', 'company_policy', 'customer_requirement', 'carrier_facility_requirement', 'contract_obligation')),
  CONSTRAINT "compliance_rule_version_country_check" CHECK ("jurisdiction_country_code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "compliance_rule_version_dates_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from"),
  CONSTRAINT "compliance_rule_version_battery_check" CHECK ("battery_requirement" IN ('any', 'present', 'absent')),
  CONSTRAINT "compliance_rule_version_refrigerant_check" CHECK ("refrigerant_requirement" IN ('any', 'present', 'absent')),
  CONSTRAINT "compliance_rule_version_dg_check" CHECK ("dangerous_goods_requirement" IN ('any', 'regulated', 'not_regulated')),
  CONSTRAINT "compliance_rule_version_certificates_check" CHECK (jsonb_typeof("required_certificate_types") = 'array'),
  CONSTRAINT "compliance_rule_version_nodes_check" CHECK ("blocking_node_codes" = '["cargo_ready"]'::jsonb),
  CONSTRAINT "compliance_rule_version_severity_check" CHECK ("severity" IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT "compliance_rule_version_source_check" CHECK ("official_source_url" ~ '^https://'),
  CONSTRAINT "compliance_rule_version_evidence_check" CHECK (jsonb_typeof("evidence_refs") = 'array' AND jsonb_array_length("evidence_refs") > 0)
);

CREATE UNIQUE INDEX "compliance_rule_version_id_tenant_key" ON "compliance_rule_version"("id", "tenant_id");
CREATE UNIQUE INDEX "compliance_rule_version_id_scope_key" ON "compliance_rule_version"("id", "tenant_id", "rule_id");
CREATE UNIQUE INDEX "compliance_rule_version_number_key" ON "compliance_rule_version"("tenant_id", "rule_id", "version");
CREATE UNIQUE INDEX "compliance_rule_version_idempotency_key" ON "compliance_rule_version"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "compliance_rule_version_supersedes_key" ON "compliance_rule_version"("supersedes_rule_version_id", "tenant_id", "rule_id");
CREATE UNIQUE INDEX "compliance_rule_version_one_published_key" ON "compliance_rule_version"("tenant_id", "rule_id") WHERE "state" = 'published';
CREATE INDEX "compliance_rule_version_applicability_idx" ON "compliance_rule_version"("tenant_id", "jurisdiction_country_code", "state", "effective_from");

ALTER TABLE "compliance_rule_version" ADD CONSTRAINT "compliance_rule_version_rule_fkey"
  FOREIGN KEY ("rule_id", "tenant_id") REFERENCES "compliance_rule"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compliance_rule_version" ADD CONSTRAINT "compliance_rule_version_supersedes_fkey"
  FOREIGN KEY ("supersedes_rule_version_id", "tenant_id", "rule_id") REFERENCES "compliance_rule_version"("id", "tenant_id", "rule_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "compliance_rule_version_sku_scope" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "rule_version_id" UUID NOT NULL,
  "product_sku_id" UUID NOT NULL,
  CONSTRAINT "compliance_rule_version_sku_scope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compliance_rule_version_sku_key" ON "compliance_rule_version_sku_scope"("rule_version_id", "product_sku_id");
CREATE INDEX "compliance_rule_sku_tenant_idx" ON "compliance_rule_version_sku_scope"("tenant_id", "product_sku_id");
ALTER TABLE "compliance_rule_version_sku_scope" ADD CONSTRAINT "compliance_rule_version_sku_rule_fkey"
  FOREIGN KEY ("rule_version_id", "tenant_id") REFERENCES "compliance_rule_version"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "cargo_ready_compliance_assessment" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "container_record_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "jurisdiction_country_code" CHAR(2) NOT NULL,
  "assessment_date" DATE NOT NULL,
  "allocation_set_id" UUID,
  "allocation_set_version" INTEGER,
  "supersedes_assessment_id" UUID,
  "evidence_refs" JSONB NOT NULL,
  "actor_id" TEXT NOT NULL,
  "reason_code" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "superseded_at" TIMESTAMPTZ,
  CONSTRAINT "cargo_ready_compliance_assessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cargo_ready_assessment_state_check" CHECK ("state" IN ('action_required', 'ready_for_decision', 'decided', 'superseded')),
  CONSTRAINT "cargo_ready_assessment_country_check" CHECK ("jurisdiction_country_code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "cargo_ready_assessment_evidence_check" CHECK (jsonb_typeof("evidence_refs") = 'array'),
  CONSTRAINT "cargo_ready_assessment_version_check" CHECK ("version" > 0),
  CONSTRAINT "cargo_ready_assessment_allocation_pair_check" CHECK (("allocation_set_id" IS NULL) = ("allocation_set_version" IS NULL)),
  CONSTRAINT "cargo_ready_assessment_allocation_version_check" CHECK ("allocation_set_version" IS NULL OR "allocation_set_version" > 0)
);

CREATE UNIQUE INDEX "cargo_ready_assessment_id_tenant_key" ON "cargo_ready_compliance_assessment"("id", "tenant_id");
CREATE UNIQUE INDEX "cargo_ready_assessment_id_scope_key" ON "cargo_ready_compliance_assessment"("id", "tenant_id", "container_record_id");
CREATE UNIQUE INDEX "cargo_ready_assessment_tenant_idempotency_key" ON "cargo_ready_compliance_assessment"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "cargo_ready_assessment_container_version_key" ON "cargo_ready_compliance_assessment"("tenant_id", "container_record_id", "version");
CREATE UNIQUE INDEX "cargo_ready_assessment_supersedes_scope_key" ON "cargo_ready_compliance_assessment"("supersedes_assessment_id", "tenant_id", "container_record_id");
CREATE INDEX "cargo_ready_assessment_current_idx" ON "cargo_ready_compliance_assessment"("tenant_id", "container_record_id", "state");
CREATE UNIQUE INDEX "cargo_ready_assessment_one_current_key" ON "cargo_ready_compliance_assessment"("tenant_id", "container_record_id") WHERE "state" <> 'superseded';

ALTER TABLE "cargo_ready_compliance_assessment" ADD CONSTRAINT "cargo_ready_assessment_supersedes_fkey"
  FOREIGN KEY ("supersedes_assessment_id", "tenant_id", "container_record_id")
  REFERENCES "cargo_ready_compliance_assessment"("id", "tenant_id", "container_record_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "cargo_ready_compliance_assessment_item" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "assessment_id" UUID NOT NULL,
  "replenishment_order_line_id" TEXT NOT NULL,
  "product_sku_id" UUID NOT NULL,
  "product_number" TEXT NOT NULL,
  "compliance_profile_id" UUID,
  "compliance_profile_version" INTEGER,
  CONSTRAINT "cargo_ready_compliance_assessment_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cargo_ready_assessment_item_profile_pair_check" CHECK (("compliance_profile_id" IS NULL) = ("compliance_profile_version" IS NULL)),
  CONSTRAINT "cargo_ready_assessment_item_profile_version_check" CHECK ("compliance_profile_version" IS NULL OR "compliance_profile_version" > 0)
);

CREATE UNIQUE INDEX "cargo_ready_assessment_item_line_key" ON "cargo_ready_compliance_assessment_item"("assessment_id", "replenishment_order_line_id");
CREATE UNIQUE INDEX "cargo_ready_assessment_item_id_assessment_key" ON "cargo_ready_compliance_assessment_item"("id", "assessment_id");
CREATE INDEX "cargo_ready_assessment_item_sku_idx" ON "cargo_ready_compliance_assessment_item"("tenant_id", "product_sku_id");
ALTER TABLE "cargo_ready_compliance_assessment_item" ADD CONSTRAINT "cargo_ready_assessment_item_assessment_fkey"
  FOREIGN KEY ("assessment_id", "tenant_id") REFERENCES "cargo_ready_compliance_assessment"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "cargo_ready_compliance_finding" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "assessment_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "product_sku_id" UUID,
  "rule_version_id" UUID,
  "detail" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'open',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cargo_ready_compliance_finding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cargo_ready_finding_state_check" CHECK ("state" IN ('open', 'resolved', 'voided'))
);

CREATE INDEX "cargo_ready_finding_assessment_idx" ON "cargo_ready_compliance_finding"("tenant_id", "assessment_id", "state");
ALTER TABLE "cargo_ready_compliance_finding" ADD CONSTRAINT "cargo_ready_finding_assessment_fkey"
  FOREIGN KEY ("assessment_id", "tenant_id") REFERENCES "cargo_ready_compliance_assessment"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "cargo_ready_compliance_assessment_rule" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "assessment_id" UUID NOT NULL,
  "rule_version_id" UUID NOT NULL,
  "product_sku_id" UUID NOT NULL,
  CONSTRAINT "cargo_ready_compliance_assessment_rule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cargo_ready_assessment_rule_sku_key" ON "cargo_ready_compliance_assessment_rule"("assessment_id", "rule_version_id", "product_sku_id");
CREATE INDEX "cargo_ready_assessment_rule_tenant_idx" ON "cargo_ready_compliance_assessment_rule"("tenant_id", "rule_version_id");
ALTER TABLE "cargo_ready_compliance_assessment_rule" ADD CONSTRAINT "cargo_ready_assessment_rule_assessment_fkey"
  FOREIGN KEY ("assessment_id", "tenant_id") REFERENCES "cargo_ready_compliance_assessment"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cargo_ready_compliance_assessment_rule" ADD CONSTRAINT "cargo_ready_assessment_rule_version_fkey"
  FOREIGN KEY ("rule_version_id", "tenant_id") REFERENCES "compliance_rule_version"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "cargo_ready_compliance_decision" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "assessment_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "decision_code" TEXT NOT NULL,
  "condition_refs" JSONB NOT NULL,
  "supersedes_decision_id" UUID,
  "evidence_refs" JSONB NOT NULL,
  "actor_id" TEXT NOT NULL,
  "reason_code" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "decided_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "superseded_at" TIMESTAMPTZ,
  CONSTRAINT "cargo_ready_compliance_decision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cargo_ready_decision_code_check" CHECK ("decision_code" IN ('approved', 'approved_with_conditions', 'blocked', 'evidence_required')),
  CONSTRAINT "cargo_ready_decision_evidence_check" CHECK (jsonb_typeof("evidence_refs") = 'array'),
  CONSTRAINT "cargo_ready_decision_conditions_type_check" CHECK (jsonb_typeof("condition_refs") = 'array'),
  CONSTRAINT "cargo_ready_decision_conditions_required_check" CHECK (("decision_code" = 'approved_with_conditions') = (jsonb_array_length("condition_refs") > 0)),
  CONSTRAINT "cargo_ready_decision_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "cargo_ready_decision_id_tenant_key" ON "cargo_ready_compliance_decision"("id", "tenant_id");
CREATE UNIQUE INDEX "cargo_ready_decision_id_scope_key" ON "cargo_ready_compliance_decision"("id", "tenant_id", "assessment_id");
CREATE UNIQUE INDEX "cargo_ready_decision_tenant_idempotency_key" ON "cargo_ready_compliance_decision"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "cargo_ready_decision_assessment_version_key" ON "cargo_ready_compliance_decision"("assessment_id", "version");
CREATE UNIQUE INDEX "cargo_ready_decision_supersedes_scope_key" ON "cargo_ready_compliance_decision"("supersedes_decision_id", "tenant_id", "assessment_id");
CREATE INDEX "cargo_ready_decision_current_idx" ON "cargo_ready_compliance_decision"("tenant_id", "assessment_id", "superseded_at");
CREATE UNIQUE INDEX "cargo_ready_decision_one_current_key" ON "cargo_ready_compliance_decision"("assessment_id") WHERE "superseded_at" IS NULL;

ALTER TABLE "cargo_ready_compliance_decision" ADD CONSTRAINT "cargo_ready_decision_assessment_fkey"
  FOREIGN KEY ("assessment_id", "tenant_id") REFERENCES "cargo_ready_compliance_assessment"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cargo_ready_compliance_decision" ADD CONSTRAINT "cargo_ready_decision_supersedes_fkey"
  FOREIGN KEY ("supersedes_decision_id", "tenant_id", "assessment_id") REFERENCES "cargo_ready_compliance_decision"("id", "tenant_id", "assessment_id") ON DELETE RESTRICT ON UPDATE CASCADE;
