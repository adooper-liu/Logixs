BEGIN;
ALTER TABLE ocean_carrier_reference
  ALTER COLUMN name_zh DROP NOT NULL,
  ADD COLUMN standard_code TEXT,
  ADD COLUMN standard_version TEXT,
  ADD COLUMN source_url TEXT,
  ADD COLUMN source_row INTEGER,
  ADD COLUMN parent_code TEXT,
  ADD COLUMN is_vocc BOOLEAN,
  ADD COLUMN is_nvocc BOOLEAN,
  ADD COLUMN valid_from DATE,
  ADD COLUMN valid_until DATE;
ALTER TABLE ocean_carrier_reference DROP CONSTRAINT ocean_carrier_reference_status_check;
ALTER TABLE ocean_carrier_reference ADD CONSTRAINT ocean_carrier_reference_status_check
  CHECK (status IN ('active','deprecated','not_yet_valid','review_required'));
ALTER TABLE ocean_carrier_reference ADD CONSTRAINT ocean_carrier_standard_source_check
  CHECK (standard_code IS NULL OR (standard_version IS NOT NULL AND source_url IS NOT NULL AND source_row > 0));
ALTER TABLE container_type_reference ADD COLUMN standard_basis JSONB;
COMMIT;
