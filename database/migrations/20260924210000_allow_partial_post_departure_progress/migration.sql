-- Candidate progress is a versioned draft. Missing business facts remain pending
-- instead of preventing the operator from saving work already completed.
ALTER TABLE "post_departure_source_candidate_correction"
  DROP CONSTRAINT "post_departure_candidate_grouping_shape_check";

ALTER TABLE "post_departure_source_candidate_correction"
  ALTER COLUMN "shipment_grouping_kind" DROP DEFAULT,
  ALTER COLUMN "shipment_grouping_kind" DROP NOT NULL,
  ALTER COLUMN "origin_port_id" DROP NOT NULL,
  ALTER COLUMN "origin_unlocode" DROP NOT NULL,
  ALTER COLUMN "destination_port_id" DROP NOT NULL,
  ALTER COLUMN "destination_unlocode" DROP NOT NULL,
  ALTER COLUMN "departure_occurred_at" DROP NOT NULL,
  ALTER COLUMN "departure_source_timezone" DROP NOT NULL,
  ALTER COLUMN "departure_evidence_id" DROP NOT NULL,
  ADD COLUMN "departure_local" TEXT;

ALTER TABLE "post_departure_source_candidate_correction"
  ADD CONSTRAINT "post_departure_candidate_grouping_shape_check"
  CHECK (
    (
      "shipment_grouping_kind" IS NULL
      AND "shipment_number" IS NULL
      AND "target_shipment_id" IS NULL
      AND "target_relationship_version" IS NULL
    )
    OR (
      "shipment_grouping_kind" = 'authorized_new_shipment'
      AND "shipment_number" IS NOT NULL
      AND "target_shipment_id" IS NULL
      AND "target_relationship_version" IS NULL
    )
    OR (
      "shipment_grouping_kind" = 'existing_shipment'
      AND "shipment_number" IS NULL
      AND "target_shipment_id" IS NOT NULL
      AND "target_relationship_version" IS NOT NULL
      AND "target_relationship_version" > 0
    )
    OR (
      "shipment_grouping_kind" = 'new_independent_shipment'
      AND "shipment_number" IS NULL
      AND "target_shipment_id" IS NULL
      AND "target_relationship_version" IS NULL
    )
  ),
  ADD CONSTRAINT "post_departure_candidate_correction_departure_local_check"
  CHECK (
    "departure_local" IS NULL
    OR "departure_local" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2})?$'
  );

-- Authentication subjects are stable strings; OIDC subjects are not required to be UUIDs.
ALTER TABLE "shipment"
  ALTER COLUMN "created_by" TYPE TEXT USING "created_by"::TEXT,
  ALTER COLUMN "updated_by" TYPE TEXT USING "updated_by"::TEXT;

ALTER TABLE "shipment_handoff_record"
  ALTER COLUMN "actor_id" TYPE TEXT USING "actor_id"::TEXT;
