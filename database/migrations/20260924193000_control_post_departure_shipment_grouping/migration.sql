ALTER TABLE "post_departure_source_candidate_correction"
  ADD COLUMN "shipment_grouping_kind" TEXT NOT NULL DEFAULT 'authorized_new_shipment',
  ADD COLUMN "target_shipment_id" UUID,
  ADD COLUMN "target_relationship_version" INTEGER;

ALTER TABLE "post_departure_source_candidate_correction"
  ALTER COLUMN "shipment_number" DROP NOT NULL;

ALTER TABLE "post_departure_source_candidate_correction"
  ADD CONSTRAINT "post_departure_candidate_grouping_shape_check"
  CHECK (
    (
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
  );

ALTER TABLE "post_departure_source_candidate_correction"
  ADD CONSTRAINT "post_departure_candidate_correction_target_shipment_fkey"
  FOREIGN KEY ("target_shipment_id", "tenant_id")
  REFERENCES "shipment"("id", "tenant_id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE INDEX "post_departure_candidate_correction_target_shipment_idx"
  ON "post_departure_source_candidate_correction"("target_shipment_id", "tenant_id");
