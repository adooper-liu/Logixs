-- CreateTable
CREATE TABLE "ocean_provider_event_ingestion" (
    "id" TEXT NOT NULL,
    "inbox_message_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "interface_code" TEXT NOT NULL,
    "provider_event_id_raw" TEXT,
    "idempotency_key" TEXT,
    "raw_payload" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "payload_hash_version" TEXT NOT NULL,
    "container_number_raw" TEXT NOT NULL,
    "raw_code" TEXT NOT NULL,
    "event_time_raw" TEXT NOT NULL,
    "mapping_version" TEXT NOT NULL,
    "normalization_kind" TEXT NOT NULL,
    "canonical_event_code" TEXT,
    "occurred_at" TIMESTAMPTZ,
    "time_kind" TEXT,
    "source_code_raw" TEXT NOT NULL,
    "source_signal" TEXT,
    "authority_decision" TEXT NOT NULL,
    "authority_policy_ref" TEXT,
    "confidence_state" TEXT NOT NULL,
    "reason_codes" JSONB NOT NULL,
    "lifecycle_application" TEXT NOT NULL,
    "decided_by" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL,
    "decided_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocean_provider_event_ingestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ocean_provider_ingestion_payload_hash_check"
      CHECK ("payload_hash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "ocean_provider_ingestion_raw_payload_check"
      CHECK (jsonb_typeof("raw_payload") = 'object'),
    CONSTRAINT "ocean_provider_ingestion_reason_codes_check"
      CHECK (jsonb_typeof("reason_codes") = 'array'),
    CONSTRAINT "ocean_provider_ingestion_normalization_check"
      CHECK ("normalization_kind" IN ('candidate', 'review_required', 'rejected')),
    CONSTRAINT "ocean_provider_ingestion_authority_check"
      CHECK ("authority_decision" IN ('review_required', 'rejected')),
    CONSTRAINT "ocean_provider_ingestion_confidence_check"
      CHECK ("confidence_state" IN ('provisional', 'unknown')),
    CONSTRAINT "ocean_provider_ingestion_lifecycle_check"
      CHECK ("lifecycle_application" = 'not_applied'),
    CONSTRAINT "ocean_provider_ingestion_candidate_fields_check"
      CHECK (
        "normalization_kind" <> 'candidate'
        OR (
          "canonical_event_code" IS NOT NULL
          AND "occurred_at" IS NOT NULL
          AND "time_kind" IS NOT NULL
          AND "source_signal" IS NOT NULL
          AND "idempotency_key" IS NOT NULL
        )
      ),
    CONSTRAINT "ocean_provider_ingestion_decision_alignment_check"
      CHECK (
        ("normalization_kind" = 'rejected' AND "authority_decision" = 'rejected')
        OR
        ("normalization_kind" <> 'rejected' AND "authority_decision" = 'review_required')
      )
);

-- CreateIndex
CREATE UNIQUE INDEX "ocean_provider_event_ingestion_inbox_message_id_key"
ON "ocean_provider_event_ingestion"("inbox_message_id");

-- CreateIndex
CREATE INDEX "ocean_provider_ingestion_tenant_decision_idx"
ON "ocean_provider_event_ingestion"("tenant_id", "authority_decision", "received_at", "id");

-- CreateIndex
CREATE INDEX "ocean_provider_ingestion_business_key_idx"
ON "ocean_provider_event_ingestion"("tenant_id", "provider", "interface_code", "idempotency_key");

-- AddForeignKey
ALTER TABLE "ocean_provider_event_ingestion"
ADD CONSTRAINT "ocean_provider_event_ingestion_inbox_message_id_fkey"
FOREIGN KEY ("inbox_message_id") REFERENCES "inbox_message"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verification: all rows must reference an Inbox row and keep lifecycle_application='not_applied'.
-- Recovery: restore from backup before dropping this append-only table; no existing table is rewritten.
