-- Business facts may arrive after an already-departed Shipment is created.
-- Internal identity, tenant ownership and relationship foreign keys remain strict.
ALTER TABLE "shipment"
ALTER COLUMN "source_record_id" DROP NOT NULL,
ALTER COLUMN "carrier_code" DROP NOT NULL,
ALTER COLUMN "vessel_name" DROP NOT NULL,
ALTER COLUMN "voyage_number" DROP NOT NULL,
ALTER COLUMN "origin_country_code" DROP NOT NULL,
ALTER COLUMN "origin_unlocode" DROP NOT NULL,
ALTER COLUMN "destination_country_code" DROP NOT NULL,
ALTER COLUMN "destination_unlocode" DROP NOT NULL;

-- Verification after deploy:
-- 1. Existing complete Shipment rows retain every value unchanged.
-- 2. A departed Shipment can be inserted with these business facts absent.
-- 3. Duplicate non-null source identities are still rejected by
--    shipment_source_identity_key.
-- Recovery: restoring NOT NULL requires every new null value to be completed first;
-- do not contract while any accepted Shipment still has open data gaps.
