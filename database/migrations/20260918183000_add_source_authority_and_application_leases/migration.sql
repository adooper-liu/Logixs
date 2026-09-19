-- Runtime source-authority policies are versioned data. No supplier is trusted by default;
-- an empty table intentionally routes actual facts to review.
CREATE TABLE "source_authority_policy" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "policy_version" INTEGER NOT NULL,
    "effective_from" TIMESTAMPTZ NOT NULL,
    "effective_to" TIMESTAMPTZ,
    "tenant_scope" TEXT,
    "fact_type" TEXT,
    "event_code" TEXT,
    "field_code" TEXT,
    "subject_type" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "direction" TEXT,
    "location_role" TEXT,
    "transport_mode" TEXT,
    "time_kind" TEXT,
    "allowed_authority_systems" JSONB NOT NULL,
    "allowed_source_types" JSONB NOT NULL,
    "minimum_authority_level" TEXT NOT NULL,
    "required_evidence_types" JSONB NOT NULL,
    "verification_requirements" JSONB NOT NULL,
    "corroboration_rule" TEXT,
    "conflict_action" TEXT NOT NULL,
    "manual_correction_policy_ref" TEXT NOT NULL,
    "sealing_policy_ref" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "source_authority_policy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "source_authority_policy_version_check" CHECK ("policy_version" >= 1),
    CONSTRAINT "source_authority_policy_effective_check" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
    CONSTRAINT "source_authority_policy_target_check" CHECK (num_nonnulls("fact_type", "event_code", "field_code") = 1),
    CONSTRAINT "source_authority_policy_time_kind_check" CHECK ("time_kind" IS NULL OR "time_kind" IN ('planned', 'estimated', 'actual')),
    CONSTRAINT "source_authority_policy_level_check" CHECK ("minimum_authority_level" IN ('authoritative', 'corroborating', 'operational', 'contextual')),
    CONSTRAINT "source_authority_policy_conflict_check" CHECK ("conflict_action" IN ('accept', 'reject', 'review')),
    CONSTRAINT "source_authority_policy_arrays_check" CHECK (
      jsonb_typeof("allowed_authority_systems") = 'array'
      AND jsonb_array_length("allowed_authority_systems") > 0
      AND jsonb_typeof("allowed_source_types") = 'array'
      AND jsonb_array_length("allowed_source_types") > 0
      AND jsonb_typeof("required_evidence_types") = 'array'
      AND jsonb_typeof("verification_requirements") = 'array'
      AND jsonb_array_length("verification_requirements") > 0
    )
);

CREATE UNIQUE INDEX "source_authority_policy_version_key"
ON "source_authority_policy"("policy_id", "policy_version");

CREATE INDEX "source_authority_policy_event_idx"
ON "source_authority_policy"("event_code", "subject_type", "effective_from");

CREATE INDEX "source_authority_policy_scope_idx"
ON "source_authority_policy"("tenant_scope", "event_code", "time_kind");

ALTER TABLE "lifecycle_date_fact"
ADD COLUMN "application_lease_owner" TEXT,
ADD COLUMN "application_lease_until" TIMESTAMPTZ,
ADD COLUMN "application_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_application_at" TIMESTAMPTZ;

ALTER TABLE "lifecycle_date_fact"
ADD CONSTRAINT "lifecycle_date_fact_application_attempts_check"
CHECK ("application_attempts" >= 0);

CREATE INDEX "lifecycle_date_fact_pending_claim_idx"
ON "lifecycle_date_fact"("tenant_id", "container_id", "application_state", "occurred_at", "projection_version", "id");

-- Verification: policy versions are unique and pending facts can be claimed in business-time order.
-- Recovery: keep policy history and lease columns during application rollback; dropping the policy table
-- removes runtime authority decisions and must only follow a reviewed backup/restore plan.
