BEGIN;

ALTER TABLE "shipment_handoff_record"
ADD CONSTRAINT "shipment_handoff_profile_check_v2"
CHECK (
  "source_profile" IN (
    'legacy_departed_file_v1',
    'packing_platform_v1',
    'internal_fulfillment_v1',
    'api_v1'
  )
) NOT VALID;

ALTER TABLE "shipment_handoff_record"
VALIDATE CONSTRAINT "shipment_handoff_profile_check_v2";

ALTER TABLE "shipment_handoff_record"
DROP CONSTRAINT "shipment_handoff_profile_check";

ALTER TABLE "shipment_handoff_record"
RENAME CONSTRAINT "shipment_handoff_profile_check_v2"
TO "shipment_handoff_profile_check";

COMMIT;
