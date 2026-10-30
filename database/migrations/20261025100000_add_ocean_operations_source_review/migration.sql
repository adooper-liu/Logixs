BEGIN;

CREATE TABLE "ocean_operations_source_review" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "container_id" TEXT NOT NULL,
  "shipment_id" UUID,
  "source_observation_id" TEXT NOT NULL,
  "source_system" TEXT NOT NULL,
  "source_version" TEXT NOT NULL,
  "parse_state" TEXT NOT NULL,
  "source_precision" TEXT NOT NULL,
  "raw_value" TEXT NOT NULL,
  "normalized_value" TIMESTAMPTZ,
  "review_decision" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "reviewed_at" TIMESTAMPTZ NOT NULL,
  "previous_review_id" UUID,
  "write_back_target" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" CHAR(64) NOT NULL,
  "trace_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ocean_operations_source_review_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ocean_operations_source_review_container_fkey"
    FOREIGN KEY ("container_id", "tenant_id") REFERENCES "container_record"("id", "tenant_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ocean_operations_source_review_decision_check"
    CHECK ("review_decision" IN ('review_required', 'adopt_observation_for_review', 'reject_observation')),
  CONSTRAINT "ocean_operations_source_review_write_back_check"
    CHECK ("write_back_target" IN ('ocean_operations.review_projection', 'none')),
  CONSTRAINT "ocean_operations_source_review_version_check" CHECK ("version" > 0),
  CONSTRAINT "ocean_operations_source_review_reason_check" CHECK (length(btrim("reason")) BETWEEN 1 AND 1000)
);

CREATE UNIQUE INDEX "ocean_operations_review_idempotency_key"
  ON "ocean_operations_source_review"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "ocean_operations_review_container_version_key"
  ON "ocean_operations_source_review"("tenant_id", "container_id", "version");
CREATE INDEX "ocean_operations_review_container_idx"
  ON "ocean_operations_source_review"("tenant_id", "container_id", "created_at", "id");
CREATE INDEX "ocean_operations_review_queue_idx"
  ON "ocean_operations_source_review"("tenant_id", "review_decision", "created_at", "id");

CREATE FUNCTION "reject_ocean_operations_source_review_mutation"()
RETURNS trigger LANGUAGE plpgsql AS $immutable$
BEGIN
  RAISE EXCEPTION 'ocean_operations_source_review is append-only';
END;
$immutable$;
CREATE TRIGGER "ocean_operations_source_review_immutable"
BEFORE UPDATE OR DELETE ON "ocean_operations_source_review"
FOR EACH ROW EXECUTE FUNCTION "reject_ocean_operations_source_review_mutation"();

COMMIT;
