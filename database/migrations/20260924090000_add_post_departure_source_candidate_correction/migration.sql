CREATE TABLE "post_departure_source_candidate_correction" (
    "id" UUID NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "review_id" UUID NOT NULL,
    "candidate_ref" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "supersedes_correction_id" UUID,
    "shipment_number" TEXT NOT NULL,
    "origin_port_id" UUID NOT NULL,
    "origin_unlocode" CHAR(5) NOT NULL,
    "destination_port_id" UUID NOT NULL,
    "destination_unlocode" CHAR(5) NOT NULL,
    "departure_occurred_at" TIMESTAMPTZ NOT NULL,
    "departure_source_timezone" TEXT NOT NULL,
    "departure_evidence_id" UUID NOT NULL,
    "operator_id" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_departure_source_candidate_correction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "post_departure_candidate_correction_version_check" CHECK ("version" >= 1),
    CONSTRAINT "post_departure_candidate_correction_candidate_ref_check" CHECK (length(btrim("candidate_ref")) BETWEEN 1 AND 200),
    CONSTRAINT "post_departure_candidate_correction_shipment_number_check" CHECK (length(btrim("shipment_number")) BETWEEN 1 AND 100),
    CONSTRAINT "post_departure_candidate_correction_origin_unlocode_check" CHECK ("origin_unlocode" ~ '^[A-Z]{2}[A-Z0-9]{3}$'),
    CONSTRAINT "post_departure_candidate_correction_destination_unlocode_check" CHECK ("destination_unlocode" ~ '^[A-Z]{2}[A-Z0-9]{3}$'),
    CONSTRAINT "post_departure_candidate_correction_timezone_check" CHECK (length(btrim("departure_source_timezone")) BETWEEN 1 AND 100),
    CONSTRAINT "post_departure_candidate_correction_operator_check" CHECK (length(btrim("operator_id")) BETWEEN 1 AND 200),
    CONSTRAINT "post_departure_candidate_correction_reason_check" CHECK ("reason_code" ~ '^[a-z][a-z0-9_]{0,99}$'),
    CONSTRAINT "post_departure_candidate_correction_idempotency_check" CHECK (length(btrim("idempotency_key")) BETWEEN 1 AND 200),
    CONSTRAINT "post_departure_candidate_correction_payload_hash_check" CHECK ("payload_hash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "post_departure_candidate_correction_no_self_supersede_check" CHECK ("supersedes_correction_id" IS NULL OR "supersedes_correction_id" <> "id")
);

CREATE UNIQUE INDEX "post_departure_candidate_correction_id_tenant_key"
ON "post_departure_source_candidate_correction"("id", "tenant_id");

CREATE UNIQUE INDEX "post_departure_candidate_review_ref_version_key"
ON "post_departure_source_candidate_correction"("review_id", "candidate_ref", "version");

CREATE UNIQUE INDEX "post_departure_candidate_correction_tenant_idempotency_key"
ON "post_departure_source_candidate_correction"("tenant_id", "idempotency_key");

CREATE INDEX "post_departure_candidate_correction_current_idx"
ON "post_departure_source_candidate_correction"("review_id", "tenant_id", "candidate_ref", "version");

CREATE INDEX "post_departure_candidate_correction_supersedes_idx"
ON "post_departure_source_candidate_correction"("supersedes_correction_id", "tenant_id");

CREATE INDEX "post_departure_candidate_correction_origin_port_idx"
ON "post_departure_source_candidate_correction"("origin_port_id");

CREATE INDEX "post_departure_candidate_correction_destination_port_idx"
ON "post_departure_source_candidate_correction"("destination_port_id");

CREATE INDEX "post_departure_candidate_correction_evidence_idx"
ON "post_departure_source_candidate_correction"("departure_evidence_id");

ALTER TABLE "post_departure_source_candidate_correction"
ADD CONSTRAINT "post_departure_candidate_correction_review_fkey"
FOREIGN KEY ("review_id", "tenant_id")
REFERENCES "post_departure_source_package_review"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "post_departure_source_candidate_correction"
ADD CONSTRAINT "post_departure_candidate_correction_supersedes_fkey"
FOREIGN KEY ("supersedes_correction_id", "tenant_id")
REFERENCES "post_departure_source_candidate_correction"("id", "tenant_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- origin_port_id, destination_port_id and departure_evidence_id are cross-module
-- logical references. Their active-release, tenant and verification qualifications
-- are enforced through the master-data and document-records public Ports before insert.
