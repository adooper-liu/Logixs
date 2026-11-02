BEGIN;
ALTER TABLE external_ocean_provider_profile
  ADD COLUMN configuration JSONB,
  ADD COLUMN canonical_release_id UUID,
  ADD CONSTRAINT external_ocean_profile_canonical_release_fkey
    FOREIGN KEY (canonical_release_id) REFERENCES reference_data_release(id) ON DELETE RESTRICT;
ALTER TABLE external_ocean_reference_mapping
  ADD COLUMN source_namespace TEXT NOT NULL DEFAULT 'legacy_unspecified',
  ADD COLUMN reviewed_by TEXT,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN evidence_ref TEXT;
DROP INDEX external_ocean_mapping_profile_source_key;
CREATE UNIQUE INDEX external_ocean_mapping_profile_namespace_source_key
  ON external_ocean_reference_mapping(profile_id, source_namespace, source_code);
ALTER TABLE external_ocean_reference_mapping
  ALTER COLUMN canonical_code DROP NOT NULL,
  DROP CONSTRAINT external_ocean_mapping_text_check,
  ADD CONSTRAINT external_ocean_mapping_text_check CHECK
    (btrim(source_code) <> '' AND (canonical_code IS NULL OR btrim(canonical_code) <> '') AND btrim(reason) <> '');
ALTER TABLE external_ocean_reference_mapping ADD CONSTRAINT external_ocean_mapping_review_check
  CHECK (mapping_state <> 'confirmed' OR
    (canonical_code IS NOT NULL AND reviewed_by IS NOT NULL AND btrim(reviewed_by) <> '' AND reviewed_at IS NOT NULL
     AND evidence_ref IS NOT NULL AND btrim(evidence_ref) <> ''));
-- Preserve the original snapshot; its provider provenance was incomplete and cannot be activated.
UPDATE external_ocean_provider_profile SET status = 'deprecated'
WHERE provider = 'freightower' AND profile_version = 'container-api-reference-2026-10-29';
COMMIT;
