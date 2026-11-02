BEGIN;

CREATE TABLE "ocean_operations_arrival_preparation_result" (
  "id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "container_id" TEXT NOT NULL,
  "shipment_id" UUID,
  "source_observation_id" TEXT NOT NULL,
  "source_version" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "current_responsibility" TEXT NOT NULL,
  "next_step" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "recorded_at" TIMESTAMPTZ NOT NULL,
  "previous_result_id" UUID,
  "version" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" CHAR(64) NOT NULL,
  "trace_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ocean_operations_arrival_preparation_result_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ocean_operations_arrival_preparation_result_container_fkey"
    FOREIGN KEY ("container_id", "tenant_id") REFERENCES "container_record"("id", "tenant_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ocean_operations_arrival_preparation_result_result_check"
    CHECK ("result" IN ('usable_for_customs_preparation', 'pending_evidence', 'not_suitable_for_customs_preparation')),
  CONSTRAINT "ocean_operations_arrival_preparation_result_purpose_check"
    CHECK ("purpose" = 'customs_arrival_preparation'),
  CONSTRAINT "ocean_operations_arrival_preparation_result_version_check"
    CHECK ("version" > 0),
  CONSTRAINT "ocean_operations_arrival_preparation_result_reason_check"
    CHECK (length(btrim("reason")) BETWEEN 1 AND 1000),
  CONSTRAINT "ocean_operations_arrival_preparation_result_next_step_check"
    CHECK (length(btrim("next_step")) BETWEEN 1 AND 1000)
);

CREATE UNIQUE INDEX "ocean_operations_arrival_result_idempotency_key"
  ON "ocean_operations_arrival_preparation_result"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "ocean_operations_arrival_result_container_version_key"
  ON "ocean_operations_arrival_preparation_result"("tenant_id", "container_id", "version");
CREATE INDEX "ocean_operations_arrival_result_container_idx"
  ON "ocean_operations_arrival_preparation_result"("tenant_id", "container_id", "created_at", "id");

CREATE FUNCTION "reject_ocean_operations_arrival_preparation_result_mutation"()
RETURNS trigger LANGUAGE plpgsql AS $immutable$
BEGIN
  RAISE EXCEPTION 'ocean_operations_arrival_preparation_result is append-only';
END;
$immutable$;
CREATE TRIGGER "ocean_operations_arrival_preparation_result_immutable"
BEFORE UPDATE OR DELETE ON "ocean_operations_arrival_preparation_result"
FOR EACH ROW EXECUTE FUNCTION "reject_ocean_operations_arrival_preparation_result_mutation"();

COMMIT;
