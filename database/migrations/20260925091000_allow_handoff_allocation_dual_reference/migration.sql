BEGIN;

ALTER TABLE "container_cargo_allocation"
ADD CONSTRAINT "container_cargo_allocation_line_reference_check_v2"
CHECK (
  "replenishment_order_line_id" IS NOT NULL
  OR "shipment_cargo_line_id" IS NOT NULL
) NOT VALID;

ALTER TABLE "container_cargo_allocation"
VALIDATE CONSTRAINT "container_cargo_allocation_line_reference_check_v2";

ALTER TABLE "container_cargo_allocation"
DROP CONSTRAINT "container_cargo_allocation_line_reference_check";

ALTER TABLE "container_cargo_allocation"
RENAME CONSTRAINT "container_cargo_allocation_line_reference_check_v2"
TO "container_cargo_allocation_line_reference_check";

COMMIT;
