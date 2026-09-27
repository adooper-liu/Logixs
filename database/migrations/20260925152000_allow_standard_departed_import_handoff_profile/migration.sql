BEGIN;

ALTER TABLE "shipment_handoff_record"
ADD CONSTRAINT "shipment_handoff_profile_check_v3"
CHECK (
  "source_profile" IN (
    'legacy_departed_file_v1',
    'standard_departed_import_v1',
    'packing_platform_v1',
    'internal_fulfillment_v1',
    'api_v1'
  )
) NOT VALID;

ALTER TABLE "shipment_handoff_record"
VALIDATE CONSTRAINT "shipment_handoff_profile_check_v3";

ALTER TABLE "shipment_handoff_record"
DROP CONSTRAINT "shipment_handoff_profile_check";

ALTER TABLE "shipment_handoff_record"
RENAME CONSTRAINT "shipment_handoff_profile_check_v3"
TO "shipment_handoff_profile_check";

COMMIT;

-- Verification after deploy:
-- SELECT source_profile, COUNT(*) FROM shipment_handoff_record GROUP BY 1 ORDER BY 1;
-- SELECT convalidated FROM pg_constraint WHERE conname = 'shipment_handoff_profile_check';
-- Recovery: first prove no row uses standard_departed_import_v1, then repeat the
-- validated constraint swap with the previous four-value allowlist.
